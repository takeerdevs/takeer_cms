export function productUnitLabel(product) {
    const unit = product?.unit_type;
    if (!unit) return '';

    const quantity = Number(product?.sellable_quantity || 1);
    const symbol = unit.symbol || unit.name || 'unit';

    return quantity && quantity !== 1 ? `${formatQuantity(quantity)} ${symbol}` : symbol;
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

    const sellable = Number(snapshot.sellable_quantity || 1);
    const unitLabel = sellable && sellable !== 1
        ? `${formatQuantity(sellable)} ${snapshot.symbol || snapshot.name || 'units'}`
        : (snapshot.symbol || snapshot.name || 'unit');

    return `TZS ${price.toLocaleString()} / ${unitLabel}`;
}

export function formatQuantity(value) {
    const number = Number(value || 0);
    if (!Number.isFinite(number)) return '0';

    return number.toLocaleString(undefined, {
        minimumFractionDigits: 0,
        maximumFractionDigits: 3,
    });
}
