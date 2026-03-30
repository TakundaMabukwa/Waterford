const normalizePlate = (value: string | null | undefined) =>
  String(value || '')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')

const VEHICLE_TANK_CAPACITY_BY_PLATE: Record<string, number> = {
  YWX933GP: 500,
  FW28SMGP: 840,
  HW65MMGP: 1200,
  JM39BBGP: 900,
  JP29YVGP: 900,
  JP29YTGP: 900,
  JP88KFGP: 900,
  JW59VYGP: 900,
  JW59WDGP: 900,
  JW59WJGP: 900,
  KC31RGGP: 900,
  KD57TSGP: 900,
  KL33HWGP: 900,
  FV26GTGP: 1280,
  KN41XSGP: 900,
  KP48MNGP: 900,
  KP48MWGP: 900,
  KP48NCGP: 900,
  KP48NFGP: 900,
  KZ89MRGP: 900,
  LF60RGGP: 900,
  LC62WSGP: 900,
  LD08SLGP: 900,
  LD08STGP: 900,
  LD08SSGP: 900,
  LD08SWGP: 900,
  LS34PRGP: 900,
  LS34PMGP: 900,
  LS34PGGP: 900,
  LR78XJGP: 900,
  LR78YGGP: 900,
  LR78ZBGP: 900,
  LR81ZZGP: 900,
  LV75FKGP: 900,
  LV75GCGP: 900,
  MD69KJGP: 900,
  MD69KRGP: 900,
  MF56SKGP: 900,
  MG45YNGP: 900,
}

export const getDeclaredTankCapacity = (...plates: Array<string | null | undefined>) => {
  for (const plate of plates) {
    const normalizedPlate = normalizePlate(plate)
    if (!normalizedPlate) continue

    const tankCapacity = VEHICLE_TANK_CAPACITY_BY_PLATE[normalizedPlate]
    if (typeof tankCapacity === 'number' && tankCapacity > 0) {
      return tankCapacity
    }
  }

  return null
}

