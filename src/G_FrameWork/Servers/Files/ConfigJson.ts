export interface ConfigJson {
  modName: string;
  modTag: string;
  modId: string;
  modDescription: string;
  modImage?: string;
  modPath: string;
  modEnabled?: boolean;
  modData?: string;
  modFlow?: string;
  modVersion?: string;
}

export const ConfigJsonToPath = (configJson: ConfigJson) => {
  return configJson.modPath.substring(0, configJson.modPath.lastIndexOf('/'))
}

export type ContentType = Blob | ArrayBuffer | string | File;
