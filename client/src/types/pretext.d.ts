declare module "pretext" {
  interface MeasureOptions {
    width?: number | string;
    fontSize?: string;
    fontFamily?: string;
    fontWeight?: string | number;
    lineHeight?: string | number;
    letterSpacing?: string;
    textTransform?: string;
    [key: string]: any;
  }

  interface Dimensions {
    width: number;
    height: number;
  }

  export interface PretextApi {
    measure(text: string, options?: MeasureOptions): Dimensions;
  }

  const pretext: PretextApi;
  export default pretext;
}
