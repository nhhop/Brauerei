import { describe, it, expect } from 'vitest';
import { entryChannelIds, memberRefs, parseSensorEntry, sensorEntry } from './dashboardLayout';
import type { DashboardConfig, Sensor, Snapshot } from './types';

const ids = ['HLT', 'gyro.pitch', 'gyro.roll', 'gyro.tilt', 'gyro.ax', 'flow.rate'];

function snap(sensorIds: string[]): Snapshot {
  return { sensors: sensorIds.map((id) => ({ id }) as Sensor), actuators: [], controllers: [] };
}

function dash(sensors: string[]): DashboardConfig {
  return {
    id: 'd1', name: 'D', sensors, actuators: [], controllers: [], charts: [], programs: [], timers: [],
    sensorModes: {}, controllerModes: {}, timerModes: {},
  };
}

describe('parseSensorEntry', () => {
  it('reads a bare id as all channels', () => {
    expect(parseSensorEntry('gyro')).toEqual({ base: 'gyro', keys: null });
  });
  it('reads one channel and a key list', () => {
    expect(parseSensorEntry('gyro.pitch')).toEqual({ base: 'gyro', keys: ['pitch'] });
    expect(parseSensorEntry('gyro.pitch,roll')).toEqual({ base: 'gyro', keys: ['pitch', 'roll'] });
  });
});

describe('sensorEntry', () => {
  const all = ['pitch', 'roll', 'tilt', 'ax'];
  it('orders keys like the snapshot', () => {
    expect(sensorEntry('gyro', ['tilt', 'pitch'], all)).toBe('gyro.pitch,tilt');
  });
  it('stores a single channel as a channel id', () => {
    expect(sensorEntry('gyro', ['roll'], all)).toBe('gyro.roll');
  });
  it('stores every channel as the bare id', () => {
    expect(sensorEntry('gyro', ['ax', 'tilt', 'roll', 'pitch'], all)).toBe('gyro');
  });
  it('drops keys the sensor does not have', () => {
    expect(sensorEntry('gyro', ['pitch', 'gone'], all)).toBe('gyro.pitch');
  });
  it('round-trips through parseSensorEntry', () => {
    const e = sensorEntry('gyro', ['ax', 'roll'], all);
    expect(parseSensorEntry(e)).toEqual({ base: 'gyro', keys: ['roll', 'ax'] });
  });
});

describe('entryChannelIds', () => {
  it('lists every channel of a bare id', () => {
    expect(entryChannelIds('gyro', ids)).toEqual(['gyro.pitch', 'gyro.roll', 'gyro.tilt', 'gyro.ax']);
    expect(entryChannelIds('HLT', ids)).toEqual(['HLT']);
  });
  it('lists the picked channels in snapshot order', () => {
    expect(entryChannelIds('gyro.ax,pitch', ids)).toEqual(['gyro.pitch', 'gyro.ax']);
  });
  it('skips channels that are gone', () => {
    expect(entryChannelIds('gyro.pitch,gz', ids)).toEqual(['gyro.pitch']);
    expect(entryChannelIds('gyro.gz', ids)).toEqual([]);
  });
  it('does not match another sensor with the same prefix', () => {
    expect(entryChannelIds('gyr', ids)).toEqual([]);
  });
});

describe('memberRefs', () => {
  it('keeps every card of a sensor and drops entries without channels', () => {
    const d = dash(['gyro.pitch,roll,tilt', 'gyro.ax', 'gyro', 'gyro.gz', 'HLT', 'gone']);
    expect(memberRefs(d, snap(ids), [], [], [])).toEqual([
      'sensor/gyro.pitch,roll,tilt', 'sensor/gyro.ax', 'sensor/gyro', 'sensor/HLT',
    ]);
  });
  it('keeps a key list while at least one channel exists', () => {
    expect(memberRefs(dash(['gyro.gz,tilt']), snap(ids), [], [], [])).toEqual(['sensor/gyro.gz,tilt']);
  });
});
