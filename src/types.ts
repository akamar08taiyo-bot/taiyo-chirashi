export type Role = 'employee' | 'office_admin' | 'org_admin';
export type ShareScope = 'private' | 'office' | 'company';
export type LayoutCount = 1 | 2 | 3 | 4 | 6 | 9;
export type Orientation = 'portrait' | 'landscape';
export type PhotoShape = 'wide' | 'tall';
export type DesignStyle = 'standard' | 'simple' | 'soft' | 'product' | 'catalog';
export type SaveStatus = 'idle' | 'saving' | 'saved' | 'offline' | 'error' | 'conflict';
export type MediaKind = 'product' | 'case';
export type MediaScope = ShareScope;
export type FlyerMode = 'rental' | 'cases' | 'consumables';

export interface Organization {
  id: string;
  name: string;
  logoPath: string | null;
  logoUrl: string;
  phone: string;
  fax: string;
  address: string;
}

export interface Office {
  id: string;
  organizationId: string;
  name: string;
  address: string;
  phone: string;
  fax: string;
  isActive: boolean;
}

export interface Profile {
  id: string;
  organizationId: string;
  officeId: string;
  employeeId: string;
  displayName: string;
  phone: string;
  flyerContactName: string;
  mobilePhone: string;
  role: Role;
  isActive: boolean;
}

export interface Category {
  id: string;
  organizationId: string | null;
  name: string;
  slug: string;
  sortOrder: number;
  isActive: boolean;
}

export type PhotoFitMode = 'contain' | 'cover';

export interface PhotoTransform {
  scale: number;
  x: number;
  y: number;
  rotation: number;
  /**
   * contain: 写真全体を見せる（縦長写真にも向く）
   * cover: 枠いっぱいに見せる（必要に応じてトリミング）
   * Older saved records may not contain this property, so renderers must use a fallback.
   */
  fitMode?: PhotoFitMode;
}

export interface FlyerMediaRef {
  mediaId: string | null;
  previewUrl: string;
  originalUrl: string;
  localBlobKey: string | null;
  fileName: string;
}

export interface FlyerItem {
  id: string;
  number: number;
  title: string;
  description: string;
  productName: string;
  productCode: string;
  /** 消耗品モード専用。大分類・細分類は候補選択後も自由入力できる。 */
  /** レンタル・事例集モード用。カード左上のカテゴリバッジ（特殊寝台・手すり等）。自由入力可。 */
  equipmentCategory: string;
  /** 「介助バー無料」などの特典表示。商品ごとにON/OFFできる。 */
  assistBarFree: boolean;
  /** 特典として表示する文言。既定は「介助バー無料」。 */
  assistBarLabel: string;
  /** メーカー名。介護保険チラシで表示が求められる。 */
  maker: string;
  /** TAISコード（福祉用具情報システムの識別番号）。 */
  taisCode: string;
  consumableCategory: string;
  consumableType: string;
  specification: string;
  packSize: string;
  priceYen: number;
  showPrice: boolean;
  units: number;
  monthlyAmount: number;
  media: FlyerMediaRef | null;
  transform: PhotoTransform;
}

export interface DisplaySettings {
  showLogo: boolean;
  showUnits: boolean;
  showPrices: boolean;
  showBurden1: boolean;
  showBurden2: boolean;
  showBurden3: boolean;
}

export interface FlyerDesign {
  style: DesignStyle;
  color: string;
}

export interface FlyerContact {
  personName: string;
  mobilePhone: string;
}

export interface EditorState {
  mode: FlyerMode;
  title: string;
  subtitle: string;
  eyebrow: string;
  eyebrowNote: string;
  footerHeadline: string;
  footerNote: string;
  layoutCount: LayoutCount;
  orientation: Orientation;
  /** 写真枠の形。'wide'=横写真メイン、'tall'=縦写真メイン。テンプレートで決める。 */
  photoShape: PhotoShape;
  display: DisplaySettings;
  design: FlyerDesign;
  contact: FlyerContact;
  items: FlyerItem[];
}

export interface FlyerRecord {
  id: string;
  organizationId: string;
  officeId: string;
  ownerId: string;
  assigneeId: string;
  title: string;
  categoryId: string;
  shareScope: ShareScope;
  orientation: Orientation;
  layoutCount: LayoutCount;
  designStyle: DesignStyle;
  mainColor: string;
  editorState: EditorState;
  version: number;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
}

export interface TemplateRecord {
  id: string;
  organizationId: string;
  officeId: string | null;
  ownerId: string;
  name: string;
  categoryId: string;
  shareScope: ShareScope;
  editorState: EditorState;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
}

export interface MediaRecord {
  id: string;
  organizationId: string;
  officeId: string;
  ownerId: string;
  kind: MediaKind;
  shareScope: MediaScope;
  category: string;
  manufacturer: string;
  productName: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  originalPath: string;
  previewPath: string;
  originalUrl: string;
  previewUrl: string;
  createdAt: string;
  deletedAt: string | null;
}

export interface AuthSession {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
  userId: string;
  profile: Profile;
}

export interface AppContext {
  organization: Organization;
  offices: Office[];
  profiles: Profile[];
  categories: Category[];
}

export interface NewFlyerInput {
  mode: FlyerMode;
  categoryId: string;
  /** 作成時に選んだ営業所。会社名・住所・TEL・FAXの出力元になる。 */
  officeId: string;
  layoutCount: LayoutCount;
  templateId: string | null;
  orientation: Orientation;
}

export interface SaveResult {
  ok: boolean;
  record: FlyerRecord | null;
  conflict: boolean;
  errorMessage: string | null;
}

export interface ValidationIssue {
  code: string;
  message: string;
  itemIndex: number | null;
  severity: 'error' | 'warning';
}

export interface AiSuggestionRequest {
  mode: 'polish' | 'from_memo';
  documentMode?: FlyerMode;
  text: string;
  title: string;
}

export interface AiSuggestionResponse {
  suggestion: string;
}

export interface RuntimeConfig {
  supabaseUrl: string;
  supabaseAnonKey: string;
  authEmailDomain: string;
  aiFunctionName: string;
  appName: string;
  showDemoLogin: boolean;
}
