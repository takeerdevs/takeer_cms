export function productUnitLabel(product) {
    const unit = product?.unit_type;
    if (!unit) return '';

    const quantity = Number(product?.sellable_quantity || 1);
    const symbol = displayUnitName(unit, quantity);
    const contentLabel = productPackageContentLabel(product);

    if (contentLabel && ['piece', 'pc', 'unit'].includes(String(unit.code || unit.symbol || '').toLowerCase()) && quantity > 1) {
        return `${formatQuantity(quantity)} x ${contentLabel}`;
    }

    const baseLabel = quantity && quantity !== 1 ? `${formatQuantity(quantity)} ${symbol}` : `1 ${symbol}`;
    return contentLabel ? `${baseLabel} (${contentLabel})` : baseLabel;
}

export function productPackageContentLabel(product) {
    const unit = product?.package_content_unit_type;
    const quantity = Number(product?.package_content_quantity || 0);
    if (!unit || !quantity) return '';

    return `${formatQuantity(quantity)} ${displayUnitName(unit, quantity)}`;
}

export function productPriceLabel(product, amount = null) {
    const price = Number(amount ?? product?.checkout_price ?? product?.discounted_price ?? product?.price ?? 0);
    const unitLabel = productUnitLabel(product);

    return `TZS ${price.toLocaleString()}${unitLabel ? ` / ${unitLabel}` : ''}`;
}

export function productPriceRangeLabel(product, minAmount, maxAmount) {
    const unitLabel = productUnitLabel(product);
    const min = Number(minAmount || 0).toLocaleString();
    const max = Number(maxAmount || 0).toLocaleString();

    return `TZS ${min} - ${max}${unitLabel ? ` / ${unitLabel}` : ''}`;
}

export function productCardPriceLabel(product, amount = null) {
    const price = Number(amount ?? product?.checkout_price ?? product?.discounted_price ?? product?.price ?? 0);
    return `TZS ${price.toLocaleString()}`;
}

export function productCompactPriceLabel(product, amount = null) {
    if (product?.type === 'service' && amount === null) {
        const optionPrices = Array.isArray(product?.service_options)
            ? product.service_options
                .map((option) => Number(option?.price))
                .filter((price) => Number.isFinite(price) && price > 0)
            : [];

        if (optionPrices.length > 0) {
            const min = Math.min(...optionPrices);
            const max = Math.max(...optionPrices);

            return min === max
                ? `TZS ${compactCurrencyAmount(min)}`
                : `TZS ${compactCurrencyAmount(min)} - ${compactCurrencyAmount(max)}`;
        }
    }

    const price = Number(amount ?? product?.checkout_price ?? product?.discounted_price ?? product?.price ?? 0);
    return `TZS ${compactCurrencyAmount(price)}`;
}

export function productRailPriceLabel(product, amount = null, compact = false) {
    if (product?.type === 'service' && amount === null) {
        const optionPrices = Array.isArray(product?.service_options)
            ? product.service_options
                .map((option) => Number(option?.price))
                .filter((price) => Number.isFinite(price) && price > 0)
            : [];

        if (optionPrices.length > 0) {
            const min = Math.min(...optionPrices);
            const max = Math.max(...optionPrices);

            if (min !== max) {
                const shouldCompactRange = min >= 1000 && max >= 1000;
                const format = shouldCompactRange ? compactCurrencyAmount : formatFullAmount;

                return `TZS ${format(min)} - ${format(max)}`;
            }

            return `TZS ${formatRailSingleAmount(min)}`;
        }
    }

    const price = Number(amount ?? product?.checkout_price ?? product?.discounted_price ?? product?.price ?? 0);
    return `TZS ${formatRailSingleAmount(price)}`;
}

export function productStockLabel(product, stock = null) {
    const quantity = Number(stock ?? product?.inventory_quantity ?? product?.available_stock ?? product?.inventory_count ?? 0);
    const unit = product?.unit_type;

    if (!unit) return `${Number(quantity || 0).toLocaleString()} in stock`;

    return `${formatQuantity(quantity)} ${unit.symbol || unit.name || 'units'} in stock`;
}

export function productQuantityLabel(product, quantity = 0) {
    const unit = product?.unit_type;
    if (!unit) return `${formatQuantity(quantity)} unit${Number(quantity) === 1 ? '' : 's'}`;

    return `${formatQuantity(quantity)} ${unit.symbol || unit.name || 'units'}`;
}

export function orderQuantityLabel(order) {
    const snapshot = order?.unit_snapshot;
    const quantity = Number(order?.requested_quantity ?? order?.quantity ?? 1);
    if (!snapshot) return `${formatQuantity(quantity)} item${quantity === 1 ? '' : 's'}`;

    return `${formatQuantity(quantity)} ${snapshot.symbol || snapshot.name || 'units'}`;
}

export function orderUnitPriceLabel(order) {
    const price = Number(order?.unit_price || 0);
    const snapshot = order?.unit_snapshot;
    if (!snapshot) return `TZS ${price.toLocaleString()}`;

    const unitLabel = snapshotUnitLabel(snapshot);

    return `TZS ${price.toLocaleString()} / ${unitLabel}`;
}

function snapshotUnitLabel(snapshot) {
    const sellable = Number(snapshot.sellable_quantity || 1);
    const baseUnit = displayUnitName(snapshot, sellable);
    const contentUnit = snapshot.package_content_unit_type;
    const contentQuantity = Number(snapshot.package_content_quantity || 0);

    if (contentUnit && contentQuantity) {
        const contentLabel = `${formatQuantity(contentQuantity)} ${displayUnitName(contentUnit, contentQuantity)}`;
        if (['piece', 'pc', 'unit'].includes(String(snapshot.code || snapshot.symbol || '').toLowerCase()) && sellable > 1) {
            return `${formatQuantity(sellable)} x ${contentLabel}`;
        }
        return `${formatQuantity(sellable)} ${baseUnit} (${contentLabel})`;
    }

    return `${formatQuantity(sellable)} ${baseUnit}`;
}

export function displayUnitName(unit, quantity = 1) {
    const code = String(unit?.code || '').toLowerCase();
    const raw = unit?.symbol || unit?.name || 'unit';
    const number = Number(quantity || 1);

    if (['piece'].includes(code) || raw === 'piece') return number === 1 ? 'pc' : 'pcs';
    if (code === 'pair' || raw === 'pair') return number === 1 ? 'pair' : 'pairs';
    if (code === 'dozen' || raw === 'doz') return number === 1 ? 'dozen' : 'dozens';

    return raw;
}

export function formatQuantity(value) {
    const number = Number(value || 0);
    if (!Number.isFinite(number)) return '0';

    return number.toLocaleString(undefined, {
        minimumFractionDigits: 0,
        maximumFractionDigits: 3,
    });
}

export function compactCurrencyAmount(value) {
    const number = Number(value || 0);
    if (!Number.isFinite(number)) return '0';

    const abs = Math.abs(number);
    if (abs >= 1_000_000_000) return `${formatCompactNumber(number / 1_000_000_000)}B`;
    if (abs >= 1_000_000) return `${formatCompactNumber(number / 1_000_000)}M`;
    if (abs >= 1_000) return `${formatCompactNumber(number / 1_000)}k`;

    return number.toLocaleString(undefined, {
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
    });
}

function formatCompactNumber(value) {
    return Number(value).toLocaleString(undefined, {
        minimumFractionDigits: 0,
        maximumFractionDigits: Number.isInteger(value) ? 0 : 1,
    });
}

function formatRailSingleAmount(value) {
    const number = Number(value || 0);
    if (Math.abs(number) >= 1_000_000) {
        return compactCurrencyAmount(number);
    }

    return formatFullAmount(number);
}

function formatFullAmount(value) {
    return Number(value || 0).toLocaleString(undefined, {
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
    });
}
