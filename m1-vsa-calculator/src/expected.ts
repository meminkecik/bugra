export type Expected = {
  Vsa_M1: number;
  Vsa_M2: number;
  Vsa_M3: number;
  Vsa_M4?: number;
  Vsa_M5?: number;
  Vsa_M6?: number;
  Vsa_M7?: number;
  Vsa_M8?: number;
  Exact?: number;
};

export const EXPECTED_MAP: Record<string, Expected> = {
  "Yoshida": {
    Vsa_M1: 590,
    Vsa_M2: 550,
    Vsa_M3: 674,
    Vsa_M4: 563,
    Vsa_M5: 461,
    Vsa_M6: 596,
    Vsa_M7: 587,
    Vsa_M8: 605,
  },
  "Özkan": {
    Vsa_M1: 397,
    Vsa_M2: 364,
    Vsa_M3: 381,
    Vsa_M4: 343,
    Vsa_M5: 265,
    Vsa_M6: 362,
    Vsa_M7: 382,
    Exact: 378,
  },
  "Junbo Jia": {
    Vsa_M1: 1379,
    Vsa_M2: 1224,
    Vsa_M3: 1333,
    Vsa_M4: 1111,
    Vsa_M5: 851,
    Vsa_M6: 1164,
    Vsa_M7: 1201,
    Vsa_M8: 1208,
  },
  "Takabatake": {
    Vsa_M1: 283,
    Vsa_M2: 251,
    Vsa_M3: 225,
    Vsa_M4: 226,
    Vsa_M5: 199,
    Vsa_M6: 236,
    Vsa_M7: 226,
    Exact: 228,
  },
  "Vijendra": {
    Vsa_M1: 266,
    Vsa_M2: 255,
    Vsa_M3: 292,
    Vsa_M4: 267,
    Vsa_M5: 233,
    Vsa_M6: 283,
    Vsa_M7: 278,
    Exact: 279,
  },
  "Hasanoğlu": {
    Vsa_M1: 352,
    Vsa_M2: 324,
    Vsa_M3: 367,
    Vsa_M4: 322,
    Vsa_M5: 262,
    Vsa_M6: 346,
    Vsa_M7: 343,
    Exact: 346,
  },
  "Güllü": {
    Vsa_M1: 398,
    Vsa_M2: 391,
    Vsa_M3: 476,
    Vsa_M4: 419,
    Vsa_M5: 366,
    Vsa_M6: 442,
    Vsa_M7: 429,
    Exact: 431,
  },
  "Kokusho": {
    Vsa_M1: 534,
    Vsa_M2: 515,
    Vsa_M3: 699,
    Vsa_M4: 534,
    Vsa_M5: 445,
    Vsa_M6: 569,
    Vsa_M7: 543,
    Exact: 549,
  },
  "Antakya (3126)": {
    Vsa_M1: 428,
    Vsa_M2: 407,
    Vsa_M3: 430,
    Vsa_M4: 417,
    Vsa_M5: 374,
    Vsa_M6: 432,
    Vsa_M7: 427,
    Exact: 428,
  },
  "Dulkadiroğlu (4621)": {
    Vsa_M1: 796,
    Vsa_M2: 780,
    Vsa_M3: 808,
    Vsa_M4: 751,
    Vsa_M5: 801,
    Vsa_M6: 837,
    Vsa_M7: 810,
    Exact: 814,
  },
};
