import { createId } from '../utils/id.js';
export const demoOrganization = {
    id: 'org-tss', name: '太陽シルバーサービス(株)', logoPath: null, logoUrl: '',
    address: '福岡県朝倉郡筑前町高田585番地1', phone: '0946-21-4700', fax: '0946-21-4701'
};
export const demoOffices = [
    { id: 'office-kokura', organizationId: demoOrganization.id, name: '小倉営業所', address: '福岡県北九州市小倉北区重住3丁目11-21', phone: '093-952-1616', fax: '093-952-1627', isActive: true },
    { id: 'office-kokuraminami', organizationId: demoOrganization.id, name: '小倉南営業所', address: '福岡県北九州市小倉南区田原新町1丁目3-34', phone: '093-474-5670', fax: '093-474-5671', isActive: true },
    { id: 'office-yahatanishi', organizationId: demoOrganization.id, name: '八幡西営業所', address: '福岡県北九州市八幡西区本城東2丁目4-8', phone: '093-603-3512', fax: '093-601-3593', isActive: true },
    { id: 'office-yahatahigashi', organizationId: demoOrganization.id, name: '八幡東営業所', address: '福岡県北九州市八幡東区山路松尾町14-6', phone: '093-654-8515', fax: '093-654-8516', isActive: true },
    { id: 'office-yukuhashi', organizationId: demoOrganization.id, name: '行橋営業所', address: '福岡県行橋市大字流末1327', phone: '0930-26-9640', fax: '0930-26-9641', isActive: true },
    { id: 'office-tagawa', organizationId: demoOrganization.id, name: '田川営業所', address: '福岡県田川市川宮1200', phone: '0947-44-1895', fax: '0947-44-2372', isActive: true },
    { id: 'office-iizuka', organizationId: demoOrganization.id, name: '飯塚営業所', address: '福岡県飯塚市枝国510番地7', phone: '0948-52-6360', fax: '0948-52-6362', isActive: true },
    { id: 'office-fukuokaminami', organizationId: demoOrganization.id, name: '福岡南営業所', address: '福岡県大野城市御笠川2丁目10-15', phone: '092-504-9810', fax: '092-504-9811', isActive: true },
    { id: 'office-fukuokanishi', organizationId: demoOrganization.id, name: '福岡西営業所', address: '福岡県福岡市早良区小田部4丁目11-31', phone: '092-833-0131', fax: '092-833-0132', isActive: true },
    { id: 'office-fukuokahigashi', organizationId: demoOrganization.id, name: '福岡東営業所', address: '福岡県福岡市東区松田3丁目25-2', phone: '092-627-1150', fax: '092-627-1151', isActive: true },
    { id: 'office-kurume', organizationId: demoOrganization.id, name: '久留米営業所', address: '福岡県小郡市小郡97-19', phone: '0942-72-8822', fax: '0942-72-8833', isActive: true },
    { id: 'office-omuta', organizationId: demoOrganization.id, name: '大牟田営業所', address: '福岡県大牟田市大字歴木446-1', phone: '0944-59-1488', fax: '0944-59-1481', isActive: true },
    { id: 'office-saga', organizationId: demoOrganization.id, name: '佐賀営業所', address: '佐賀県佐賀市鍋島5丁目4-15', phone: '0952-34-1224', fax: '0952-34-1225', isActive: true },
    { id: 'office-nagasaki', organizationId: demoOrganization.id, name: '長崎営業所', address: '長崎県長崎市界2-2-4', phone: '095-834-0535', fax: '095-834-0536', isActive: true },
    { id: 'office-omura', organizationId: demoOrganization.id, name: '大村営業所', address: '長崎県大村市溝陸町643-1', phone: '0957-49-6222', fax: '0957-49-6333', isActive: true },
    { id: 'office-iki', organizationId: demoOrganization.id, name: '壱岐営業所', address: '長崎県壱岐市郷ノ浦町田中触1078', phone: '0920-47-9005', fax: '0920-47-9006', isActive: true },
    { id: 'office-kumamoto', organizationId: demoOrganization.id, name: '熊本営業所', address: '熊本県熊本市東区画図町大字下無田1432-22', phone: '096-377-7630', fax: '096-377-7631', isActive: true },
    { id: 'office-kumamotokita', organizationId: demoOrganization.id, name: '熊本北営業所', address: '熊本県熊本市北区鶴羽田1丁目10番7号', phone: '096-341-5765', fax: '096-341-5766', isActive: true },
    { id: 'office-oita', organizationId: demoOrganization.id, name: '大分営業所', address: '大分県大分市下郡東1-4-35', phone: '097-504-8001', fax: '097-504-8002', isActive: true }
];
export const demoProfiles = [
    { id: 'user-kubo', organizationId: demoOrganization.id, officeId: 'office-yukuhashi', employeeId: '1001', displayName: '久保 匠史', phone: '', flyerContactName: '久保 匠史', mobilePhone: '', role: 'office_admin', isActive: true },
    { id: 'user-doi', organizationId: demoOrganization.id, officeId: 'office-yukuhashi', employeeId: '1002', displayName: '土居', phone: '', flyerContactName: '土居', mobilePhone: '', role: 'employee', isActive: true },
    { id: 'user-kokura', organizationId: demoOrganization.id, officeId: 'office-kokura', employeeId: '2001', displayName: '小倉 太郎', phone: '', flyerContactName: '小倉 太郎', mobilePhone: '', role: 'employee', isActive: true },
    { id: 'user-admin', organizationId: demoOrganization.id, officeId: 'office-yukuhashi', employeeId: '9001', displayName: '全社管理者', phone: '', flyerContactName: '全社管理者', mobilePhone: '', role: 'org_admin', isActive: true }
];
export const demoCategories = [
    ['事例集', 'cases'], ['レンタル', 'rental'], ['住宅改修', 'renovation'], ['特定福祉用具', 'specified'], ['自費レンタル', 'private-rental'], ['商品チラシ', 'product'], ['消耗品', 'consumables']
].map(([name, slug], index) => ({ id: `cat-${slug}`, organizationId: null, name: name ?? '', slug: slug ?? '', sortOrder: index + 1, isActive: true }));
export function emptyItem(number) {
    return {
        id: createId(), number, title: `${String(number).padStart(2, '0')} タイトルを入力`, description: '', productName: '', productCode: '',
        equipmentCategory: '', maker: '', taisCode: '', assistBarFree: false, assistBarLabel: '介助バー無料',
        consumableCategory: '', consumableType: '', specification: '', packSize: '', priceYen: 0, showPrice: true, units: 0, monthlyAmount: 0,
        media: null, transform: { scale: 100, x: 50, y: 50, rotation: 0, fitMode: 'contain' }
    };
}
export function createDefaultEditorState(layoutCount = 9, mode = 'cases') {
    const state = {
        mode,
        title: '手すり設置 事例集',
        subtitle: '起き上がり・立ち上がり・移動、日常の動作に合わせて、置き型・突っ張り式を選べます。',
        eyebrow: '屋内編', eyebrowNote: '壁に穴をあけずに、必要な場所へ',
        footerHeadline: '下見・お見積り・設置まで、無料でご相談いただけます。',
        footerNote: '介護保険レンタル対象品目です。単位数・自己負担額は担当者までお気軽にお問い合わせください。',
        layoutCount, orientation: 'portrait',
        display: { showLogo: true, showUnits: true, showPrices: true, showBurden1: true, showBurden2: false, showBurden3: false },
        design: { style: 'standard', color: '#2f86c5' },
        contact: { personName: '', mobilePhone: '' },
        items: Array.from({ length: 9 }, (_, index) => emptyItem(index + 1))
    };
    if (mode === 'rental') {
        state.title = '福祉用具レンタルのご案内';
        state.subtitle = '用途や生活環境に合わせて、レンタルできる福祉用具をご案内します。';
        state.eyebrow = 'レンタル';
        state.eyebrowNote = '必要な福祉用具を分かりやすくご紹介';
    }
    else if (mode === 'consumables') {
        state.title = '施設向け 消耗品のご案内';
        state.subtitle = '日々の業務で使用する消耗品を、写真・規格・価格と一緒に分かりやすくご案内します。';
        state.eyebrow = '消耗品';
        state.eyebrowNote = '施設・事業所向け商品';
        state.footerHeadline = '必要な商品・数量・お見積りについて、お気軽にお問い合わせください。';
        state.footerNote = '掲載価格・規格・入数は作成時点の情報です。詳細は担当者までお問い合わせください。';
        state.display.showUnits = false;
        state.display.showBurden1 = false;
        state.display.showBurden2 = false;
        state.display.showBurden3 = false;
        state.display.showPrices = true;
        state.design.style = 'product';
        state.items.forEach((item) => { item.title = `${String(item.number).padStart(2, '0')} 商品`; });
    }
    return state;
}
export function createDemoEditorState() {
    const state = createDefaultEditorState(9, 'cases');
    const seed = [
        ['廊下・立ち上がり補助', '使用商品：たよレール（置き型・高さ調整式）', 'たよレール', 300, 3000],
        ['ベッドサイド', 'ベッド周りの立ち上がり、移乗を安全にサポートします。', 'たよレール／ベッド用', 250, 2500],
        ['和室・起き上がり', '畳の部屋でも設置しやすい据え置き型の手すりです。', 'ベストポジションバー', 350, 3500],
        ['室内ドアの開閉', '扉の開閉や移動時の身体保持をサポートします。', 'ベストポジションバー＋手すり', 400, 4000],
        ['キッチン・流し前', '立位保持が必要な家事動作の支えとして設置します。', 'ベストポジションバー', 350, 3500],
        ['トイレ・洗面', '便座からの立ち座り、方向転換を安全にサポートします。', 'ベストポジションバー', 400, 4000],
        ['廊下のコーナー', '方向転換のある廊下に連続して手すりを配置します。', 'ベストポジションバー', 450, 4500],
        ['玄関ホールの上がり框', '上がり框の昇降時に体を支えやすい位置へ設置します。', 'ベストポジションバー2本立て', 500, 5000],
        ['脱衣所・浴室の出入り', '浴室への出入りの動線に合わせて設置します。', 'ベストポジションバー', 450, 4500]
    ];
    state.items = state.items.map((item, index) => {
        const row = seed[index];
        if (!row)
            return item;
        const [title, description, productName, units, monthlyAmount] = row;
        return {
            ...item, title: `${String(index + 1).padStart(2, '0')} ${title}`, description, productName, units, monthlyAmount,
            media: { mediaId: `seed-${index + 1}`, previewUrl: `assets/photo${index + 1}.jpg`, originalUrl: `assets/photo${index + 1}.jpg`, localBlobKey: null, fileName: `photo${index + 1}.jpg` }
        };
    });
    return state;
}
export function createDemoContext() {
    return { organization: demoOrganization, offices: demoOffices, profiles: demoProfiles, categories: demoCategories };
}
export function createSeedFlyers() {
    const now = new Date();
    const state = createDemoEditorState();
    const make = (id, title, ownerId, officeId, shareScope, minutesAgo) => ({
        id, organizationId: demoOrganization.id, officeId, ownerId, assigneeId: ownerId, title, categoryId: 'cat-cases', shareScope,
        orientation: state.orientation, layoutCount: state.layoutCount, designStyle: state.design.style, mainColor: state.design.color,
        editorState: structuredClone(state), version: 1,
        createdAt: new Date(now.getTime() - (minutesAgo + 1000) * 60000).toISOString(),
        updatedAt: new Date(now.getTime() - minutesAgo * 60000).toISOString(), deletedAt: null
    });
    return [
        make('flyer-demo-1', '手すり設置 事例集', 'user-kubo', 'office-yukuhashi', 'office', 8),
        make('flyer-demo-2', '住宅改修 玄関事例', 'user-doi', 'office-yukuhashi', 'office', 180),
        make('flyer-demo-3', '全社共有 商品チラシ', 'user-admin', 'office-yukuhashi', 'company', 1440),
        make('flyer-demo-private-other', '土居さんの非公開作品', 'user-doi', 'office-yukuhashi', 'private', 60),
        make('flyer-demo-other-office', '小倉営業所内限定', 'user-kokura', 'office-kokura', 'office', 90)
    ];
}
export function createSeedTemplates() {
    const now = new Date().toISOString();
    const cases = createDemoEditorState();
    // 特価ベッドは1〜3モーターの3種類を並べて比較できる形にしておく。
    const specialBed = createDefaultEditorState(3, 'rental');
    specialBed.title = '特価ベッド ご案内';
    specialBed.subtitle = 'モーター数に合わせてお選びいただけます。';
    ['1モーター', '2モーター', '3モーター'].forEach((motor, i) => {
        const item = specialBed.items[i];
        if (!item)
            return;
        item.equipmentCategory = '特殊寝台';
        item.title = `特価ベッド ${motor}`;
        item.productName = `特価ベッド（${motor}）`;
        item.assistBarFree = true;
        item.assistBarLabel = '介助バー無料';
    });
    // 自費車いすは自走式・介助式の2種類。
    const privateWheelchair = createDefaultEditorState(2, 'rental');
    privateWheelchair.title = '自費車いす ご案内';
    privateWheelchair.subtitle = '使い方に合わせてお選びいただけます。';
    ['自走式', '介助式'].forEach((kind, i) => {
        const item = privateWheelchair.items[i];
        if (!item)
            return;
        item.equipmentCategory = '車椅子';
        item.title = `自費車いす ${kind}`;
        item.productName = `自費車いす（${kind}）`;
    });
    return [
        { id: 'tpl-railing-9', organizationId: demoOrganization.id, officeId: null, ownerId: 'user-admin', name: '屋内手すり 9枚', categoryId: 'cat-cases', shareScope: 'company', editorState: cases, createdAt: now, updatedAt: now, deletedAt: null },
        { id: 'tpl-special-bed-3', organizationId: demoOrganization.id, officeId: 'office-yukuhashi', ownerId: 'user-kubo', name: '特価ベッド 3種（1・2・3モーター）', categoryId: 'cat-private-rental', shareScope: 'office', editorState: specialBed, createdAt: now, updatedAt: now, deletedAt: null },
        { id: 'tpl-private-wheelchair-2', organizationId: demoOrganization.id, officeId: 'office-yukuhashi', ownerId: 'user-kubo', name: '自費車いす 2種（自走式・介助式）', categoryId: 'cat-private-rental', shareScope: 'office', editorState: privateWheelchair, createdAt: now, updatedAt: now, deletedAt: null },
        { id: 'tpl-renovation-2', organizationId: demoOrganization.id, officeId: null, ownerId: 'user-admin', name: '住宅改修 2枚', categoryId: 'cat-renovation', shareScope: 'company', editorState: createDefaultEditorState(2, 'cases'), createdAt: now, updatedAt: now, deletedAt: null },
        { id: 'tpl-consumables-6', organizationId: demoOrganization.id, officeId: null, ownerId: 'user-admin', name: '消耗品 商品紹介 6品', categoryId: 'cat-consumables', shareScope: 'company', editorState: createDefaultEditorState(6, 'consumables'), createdAt: now, updatedAt: now, deletedAt: null }
    ];
}
export function createSeedMedia() {
    return Array.from({ length: 9 }, (_, index) => ({
        id: `seed-${index + 1}`, organizationId: demoOrganization.id, officeId: 'office-yukuhashi', ownerId: 'user-kubo', kind: index < 3 ? 'product' : 'case',
        shareScope: 'company', category: index < 3 ? '手すり' : '事例写真', manufacturer: '', productName: index < 3 ? '手すり' : '', fileName: `photo${index + 1}.jpg`,
        mimeType: 'image/jpeg', sizeBytes: 0, originalPath: '', previewPath: '', originalUrl: `assets/photo${index + 1}.jpg`, previewUrl: `assets/photo${index + 1}.jpg`,
        createdAt: new Date(Date.now() - index * 3600000).toISOString(), deletedAt: null
    }));
}
//# sourceMappingURL=demoData.js.map