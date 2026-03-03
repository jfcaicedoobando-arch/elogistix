export interface ContainerType {
  code: string;
  name: string;
}

export const containerTypes: ContainerType[] = [
  { code: "20DRY", name: "20' Dry (Standard)" },
  { code: "40DRY", name: "40' Dry (Standard)" },
  { code: "40HC", name: "40' High Cube" },
  { code: "45HC", name: "45' High Cube" },
  { code: "20RF", name: "20' Reefer" },
  { code: "40RF", name: "40' Reefer" },
  { code: "40HCRF", name: "40' High Cube Reefer" },
  { code: "20OT", name: "20' Open Top" },
  { code: "40OT", name: "40' Open Top" },
  { code: "20FR", name: "20' Flat Rack" },
  { code: "40FR", name: "40' Flat Rack" },
  { code: "20TK", name: "20' Tank" },
  { code: "40TK", name: "40' Tank" },
  { code: "20VH", name: "20' Ventilado" },
  { code: "40VH", name: "40' Ventilado" },
  { code: "20HT", name: "20' Hard Top" },
  { code: "40HT", name: "40' Hard Top" },
  { code: "20PL", name: "20' Platform" },
  { code: "40PL", name: "40' Platform" },
  { code: "20BK", name: "20' Bulk" },
  { code: "53HC", name: "53' High Cube (Doméstico)" },
  { code: "20ISO", name: "20' ISO Tank" },
  { code: "20SD", name: "20' Side Door" },
  { code: "20DD", name: "20' Double Door" },
  { code: "40DD", name: "40' Double Door" },
  { code: "40GOH", name: "40' Garmentero (GOH)" },
  { code: "20INS", name: "20' Insulado" },
  { code: "40INS", name: "40' Insulado" },
  { code: "LCL", name: "LCL (Carga Consolidada)" },
];
