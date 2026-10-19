import JSZip from 'jszip';
import { describe, expect, it } from 'vitest';
import { buildPrompt, parseReply, payload, ReplyError, type Choices } from '../src/tune/prompt';
import { apply, load, TuneError, validate } from '../src/tune/tuner';

const choices: Choices = { use: 'decorative', priority: 'balanced', notes: '', printingOn: '', spools: {} };

async function project(opts: { settings?: Record<string, unknown>; gcode?: boolean; model?: string } = {}): Promise<Uint8Array> {
  const settings = {
    printer_model: 'Bambu Lab X1 Carbon',
    nozzle_diameter: ['0.4'],
    curr_bed_type: 'Textured PEI Plate',
    layer_height: '0.2',
    wall_loops: '2',
    sparse_infill_density: '15%',
    enable_prime_tower: '1',
    outer_wall_speed: ['200', '500'],
    nozzle_temperature: ['220', '220'],
    textured_plate_temp: ['55', '55'],
    filament_type: ['PLA', 'PLA'],
    filament_colour: ['#ff0000', '#00FF00'],
    filament_settings_id: ['Bambu PLA Basic', 'Bambu PLA Basic'],
    different_settings_to_system: ['layer_height', 'nozzle_temperature', ''],
    ...opts.settings,
  };
  const model =
    opts.model ??
    `<config>
      <object id="1"><metadata key="name" value="Carro"/><metadata key="extruder" value="1"/>
        <part id="1" subtype="normal_part"/><part id="2" subtype="modifier_part"><metadata key="extruder" value="2"/></part>
      </object>
      <plate/>
    </config>`;
  const zip = new JSZip();
  zip.file('Metadata/project_settings.config', JSON.stringify(settings));
  zip.file('Metadata/model_settings.config', model);
  zip.file('3D/3dmodel.model', '<model><metadata name="Application">BambuStudio-02.04.00.70</metadata></model>');
  if (opts.gcode) zip.file('Metadata/plate_1.gcode', 'G1');
  return zip.generateAsync({ type: 'uint8array' });
}

describe('load', () => {
  it('reads printer, filaments and tunable settings', async () => {
    const { summary } = await load(await project());
    expect(summary.printer).toBe('Bambu Lab X1 Carbon');
    expect(summary.nozzle).toBe(0.4);
    expect(summary.savedBy).toBe('BambuStudio-02.04.00.70');
    expect(summary.objects).toEqual(['Carro']);
    expect(summary.filaments.map((f) => [f.slot, f.used, f.color])).toEqual([[1, true, '#FF0000'], [2, false, '#00FF00']]);
    const keys = summary.settings.map((s) => s.key);
    expect(keys).toContain('layer_height');
    expect(keys).toContain('nozzle_temperature');
    expect(keys).toContain('textured_plate_temp');
  });

  it('groups objects by plate, and sends that grouping in the prompt', async () => {
    const model = `<config>
      <object id="2"><metadata key="name" value="Placa"/><part id="1" subtype="normal_part"/></object>
      <object id="4"><metadata key="name" value="Pista"/><part id="1" subtype="normal_part"/></object>
      <object id="6"><metadata key="name" value="Solto"/><part id="1" subtype="normal_part"/></object>
      <plate><metadata key="plater_id" value="1"/><metadata key="plater_name" value="Nome"/>
        <model_instance><metadata key="object_id" value="2"/></model_instance>
        <model_instance><metadata key="object_id" value="2"/></model_instance>
      </plate>
      <plate><metadata key="plater_id" value="2"/><metadata key="plater_name" value=""/>
        <model_instance><metadata key="object_id" value="4"/></model_instance>
      </plate>
      <plate><metadata key="plater_id" value="3"/></plate>
    </config>`;
    const { summary } = await load(await project({ model }));
    expect(summary.layout).toEqual([
      { plate: 1, name: 'Nome', objects: ['Placa'] },
      { plate: 2, name: null, objects: ['Pista'] },
    ]);
    const sent = payload(summary, choices);
    expect(sent.plates).toEqual([{ plate: 1, name: 'Nome', objects: ['Placa'] }, { plate: 2, objects: ['Pista'] }]);
    expect(sent).not.toHaveProperty('objects');
  });

  it('falls back to a plain object list without a plate layout', async () => {
    const { summary } = await load(await project());
    expect(summary.layout).toEqual([]);
    expect(payload(summary, choices)).toMatchObject({ plates: 1, objects: ['Carro'] });
  });

  it('leaves out keys whose per-variant items differ', async () => {
    const { summary } = await load(await project());
    expect(summary.settings.map((s) => s.key)).not.toContain('outer_wall_speed');
  });

  it('refuses sliced projects', async () => {
    await expect(load(await project({ gcode: true }))).rejects.toThrow(TuneError);
  });

  it('refuses a zip without Bambu settings', async () => {
    const zip = new JSZip();
    zip.file('a.txt', 'x');
    await expect(load(await zip.generateAsync({ type: 'uint8array' }))).rejects.toThrow(/project_settings/);
  });
});

describe('validate', () => {
  it('accepts valid changes and rejects the rest with a reason', async () => {
    const { summary } = await load(await project());
    const r = validate(summary, [
      { key: 'layer_height', value: '0.16', reason: 'mais detalhe' },
      { key: 'wall_loops', value: 99 },
      { key: 'made_up_key', value: '1' },
      { key: 'sparse_infill_density', value: '15' },
      { key: 'sparse_infill_pattern', value: 'gyroid' },
    ]);
    expect(r.changes.map((c) => [c.key, c.before, c.after])).toEqual([['layer_height', '0.2', '0.16']]);
    expect(r.rejected.map((x) => x.key)).toEqual(['wall_loops', 'made_up_key', 'sparse_infill_pattern']);
  });

  it('rejects a layer height over 80% of the nozzle', async () => {
    const { summary } = await load(await project());
    expect(validate(summary, [{ key: 'layer_height', value: '0.4' }]).rejected[0]?.why).toMatch(/80%/);
  });

  it('never turns off the prime tower with several colours in use', async () => {
    const model = '<config><object id="1"><metadata key="name" value="A"/><part id="1" subtype="normal_part"><metadata key="extruder" value="1"/></part><part id="2" subtype="normal_part"><metadata key="extruder" value="2"/></part></object></config>';
    const { summary } = await load(await project({ model }));
    const r = validate(summary, [{ key: 'enable_prime_tower', value: '0' }]);
    expect(r.changes).toEqual([]);
    expect(r.rejected[0]?.why).toMatch(/2 cores/);
  });
});

describe('apply', () => {
  it('rewrites only project_settings, keeps array lengths and marks keys as edited', async () => {
    const loaded = await load(await project());
    const { changes } = validate(loaded.summary, [
      { key: 'layer_height', value: '0.12' },
      { key: 'nozzle_temperature', value: '215' },
      { key: 'sparse_infill_density', value: '25' },
    ]);
    const out = await JSZip.loadAsync(await apply(loaded, changes));
    const s = JSON.parse(await out.file('Metadata/project_settings.config')!.async('string'));
    expect(s.layer_height).toBe('0.12');
    expect(s.nozzle_temperature).toEqual(['215', '215']);
    expect(s.sparse_infill_density).toBe('25%');
    expect(s.outer_wall_speed).toEqual(['200', '500']);
    expect(s.different_settings_to_system[0]).toBe('layer_height;sparse_infill_density');
    expect(s.different_settings_to_system[1]).toBe('nozzle_temperature');
    expect(s.different_settings_to_system[2]).toBe('nozzle_temperature');
    expect(await out.file('Metadata/model_settings.config')!.async('string')).toContain('Carro');
  });

  it('refuses a change the file cannot take', async () => {
    const loaded = await load(await project());
    await expect(apply(loaded, [{ key: 'outer_wall_speed', after: '100' }])).rejects.toThrow(TuneError);
  });
});

describe('prompt', () => {
  it('sends only closed-list settings, used filaments and typed context', async () => {
    const { summary } = await load(await project());
    const p = payload(summary, { ...choices, notes: ' pouca resistência ', spools: { 1: 'Bambu PLA Matte Red' } });
    expect(p.notes).toBe('pouca resistência');
    expect(p.filaments).toEqual([{ slot: 1, in_project: 'PLA #FF0000 Bambu PLA Basic', spool: 'Bambu PLA Matte Red' }]);
    expect(Object.keys(p.settings as object)).not.toContain('outer_wall_speed');
    expect(p).not.toHaveProperty('per_object_overrides');
    expect(buildPrompt(summary, choices)).toContain('"allowed": "0.04–0.6"');
  });
});

describe('parseReply', () => {
  it('tolerates code fences and accepts the PT keys', () => {
    const r = parseReply('Aqui está:\n```json\n{"nota":"ok","alteracoes":[{"chave":"layer_height","valor":"0.16","motivo":"x"}]}\n```');
    expect(r.note).toBe('ok');
    expect(r.changes).toEqual([{ key: 'layer_height', value: '0.16', reason: 'x' }]);
  });

  it('accepts an empty list', () => {
    expect(parseReply('{"note":"nada","changes":[]}').changes).toEqual([]);
  });

  it('rejects non-JSON and missing lists', () => {
    expect(() => parseReply('não sei')).toThrow(ReplyError);
    expect(() => parseReply('{"note":"x"}')).toThrow(ReplyError);
  });
});
