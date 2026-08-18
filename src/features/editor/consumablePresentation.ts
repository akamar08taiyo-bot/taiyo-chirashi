import type { FlyerItem, LayoutCount } from '../../types.js';
import { layoutProductName, type ProductNameLayout } from '../../utils/productName.js';

export interface ConsumablePresentation {
  categoryLabel: string;
  specificationLabel: string;
  productLayout: ProductNameLayout;
  priceLabel: string;
  showPrice: boolean;
}

/**
 * A4 HTML preview and high-quality Canvas export must use the exact same
 * consumables presentation rules. Keeping this pure also makes regressions
 * testable without a browser canvas implementation.
 */
export function getConsumablePresentation(
  item: FlyerItem,
  layoutCount: LayoutCount,
  showPrices: boolean,
): ConsumablePresentation {
  const softLimit = layoutCount >= 6 ? 20 : layoutCount >= 3 ? 28 : 36;
  const categoryLabel = [item.consumableCategory, item.consumableType].filter(Boolean).join(' › ');
  const specificationLabel = [item.specification, item.packSize].filter(Boolean).join(' ／ ');
  const showPrice = showPrices && item.showPrice && Number.isFinite(item.priceYen) && item.priceYen > 0;
  return {
    categoryLabel,
    specificationLabel,
    productLayout: layoutProductName(item.productName, softLimit),
    priceLabel: showPrice ? `${Math.max(0, item.priceYen).toLocaleString('ja-JP')}円` : '',
    showPrice,
  };
}
