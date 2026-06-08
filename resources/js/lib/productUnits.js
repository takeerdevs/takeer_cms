export function productUnitLabel(product) {
    const unit = product?.unit_type;
    if (!unit) return '';

    const quantity = Number(product?.sellable_quantity || 1);
    const symbol = displayUnitName(unit, quantity);
    const contentLabel = productPackageContentLabel(product);

    if (contentLabel && ['piece', 'pc', 'unit'].includes(String(unit.code || unit.symbol || '').toLowerCase()) && quantity > 1) {
        return `${formatQuantity(quantity)} ${symbol} (${contentLabel})`;
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
    const price = displayMoneyAmount(product, amount ?? product?.checkout_price ?? product?.discounted_price ?? product?.price ?? 0);
    const unitLabel = productUnitLabel(product);

    return `${formatProductMoney(product, price)}${unitLabel ? ` / ${unitLabel}` : ''}`;
}

export function productPriceRangeLabel(product, minAmount, maxAmount) {
    const unitLabel = productUnitLabel(product);
    const min = formatProductMoney(product, displayMoneyAmount(product, minAmount || 0));
    const max = formatProductMoney(product, displayMoneyAmount(product, maxAmount || 0));

    return `${min} - ${max}${unitLabel ? ` / ${unitLabel}` : ''}`;
}

export function productCardPriceLabel(product, amount = null) {
    const price = displayMoneyAmount(product, amount ?? product?.checkout_price ?? product?.discounted_price ?? product?.price ?? 0);
    return formatProductMoney(product, price);
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
                ? formatProductMoney(product, displayMoneyAmount(product, min), true)
                : `${formatProductMoney(product, displayMoneyAmount(product, min), true)} - ${formatProductMoney(product, displayMoneyAmount(product, max), true)}`;
        }
    }

    const price = displayMoneyAmount(product, amount ?? product?.checkout_price ?? product?.discounted_price ?? product?.price ?? 0);
    return formatProductMoney(product, price, true);
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

                return `${formatProductMoney(product, displayMoneyAmount(product, min), shouldCompactRange)} - ${formatProductMoney(product, displayMoneyAmount(product, max), shouldCompactRange)}`;
            }

            return formatProductMoney(product, displayMoneyAmount(product, min), true);
        }
    }

    const price = displayMoneyAmount(product, amount ?? product?.checkout_price ?? product?.discounted_price ?? product?.price ?? 0);
    return formatProductMoney(product, price, compact);
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

    if (isPackageSnapshot(snapshot)) {
        const packageCount = orderPackageCount(order);
        return `${formatQuantity(packageCount)} package${packageCount === 1 ? '' : 's'}`;
    }

    return `${formatQuantity(quantity)} ${snapshot.symbol || snapshot.name || 'units'}`;
}

export function orderPackageCount(order) {
    const snapshot = order?.unit_snapshot;
    const quantity = Number(order?.requested_quantity ?? order?.quantity ?? 1);
    if (!snapshot || !isPackageSnapshot(snapshot)) return quantity;
    if (snapshot.quantity_represents_packages === true) return quantity;

    const sellable = Math.max(0.001, Number(snapshot.sellable_quantity || 1));
    return quantity / sellable;
}

export function orderUnitPriceLabel(order) {
    const price = Number(order?.unit_price || 0);
    const snapshot = order?.unit_snapshot;
    const currency = order?.merchant_currency_code || order?.currency_code || order?.merchant?.currency?.code || 'TZS';
    const formattedPrice = formatMoney(price, currency);
    if (!snapshot) return formattedPrice;

    const unitLabel = snapshotUnitLabel(snapshot);

    return `${formattedPrice} / ${unitLabel}`;
}

function displayMoneyAmount(product, amount) {
    const directAmount = product?.display_pricing?.amounts;
    if (amount === product?.checkout_price && directAmount?.checkout_price !== undefined && directAmount?.checkout_price !== null) {
        return Number(directAmount.checkout_price);
    }
    if (amount === product?.discounted_price && directAmount?.discounted_price !== undefined && directAmount?.discounted_price !== null) {
        return Number(directAmount.discounted_price);
    }
    if (amount === product?.price && directAmount?.price !== undefined && directAmount?.price !== null) {
        return Number(directAmount.price);
    }

    return Number(amount || 0) * Number(product?.display_pricing?.fx_rate_merchant_to_customer || 1);
}

function formatProductMoney(product, amount, compact = false) {
    const currency = product?.display_pricing?.customer_currency_code || product?.currency_code || product?.currency?.code || 'TZS';
    const number = Number(amount || 0);
    if (compact) {
        return `${currency} ${compactCurrencyAmount(number)}`;
    }

    try {
        return new Intl.NumberFormat(undefined, {
            style: 'currency',
            currency,
            minimumFractionDigits: ['TZS', 'JPY', 'KRW'].includes(currency) ? 0 : 2,
            maximumFractionDigits: ['TZS', 'JPY', 'KRW'].includes(currency) ? 0 : 2,
        }).format(number);
    } catch {
        return `${currency} ${number.toLocaleString()}`;
    }
}

function formatMoney(amount, currency = 'TZS') {
    const number = Number(amount || 0);

    try {
        return new Intl.NumberFormat(undefined, {
            style: 'currency',
            currency,
            minimumFractionDigits: ['TZS', 'JPY', 'KRW'].includes(currency) ? 0 : 2,
            maximumFractionDigits: ['TZS', 'JPY', 'KRW'].includes(currency) ? 0 : 2,
        }).format(number);
    } catch {
        return `${currency} ${number.toLocaleString()}`;
    }
}

function snapshotUnitLabel(snapshot) {
    const sellable = Number(snapshot.sellable_quantity || 1);
    const baseUnit = displayUnitName(snapshot, sellable);
    const contentUnit = snapshot.package_content_unit_type;
    const contentQuantity = Number(snapshot.package_content_quantity || 0);

    if (isPackageSnapshot(snapshot) && !contentQuantity) {
        return '1 package';
    }

    if (contentUnit && contentQuantity) {
        const contentLabel = `${formatQuantity(contentQuantity)} ${displayUnitName(contentUnit, contentQuantity)}`;
        if (['piece', 'pc', 'unit'].includes(String(snapshot.code || snapshot.symbol || '').toLowerCase()) && sellable > 1) {
            return `${formatQuantity(sellable)} ${baseUnit} (${contentLabel})`;
        }
        return '1 package';
    }

    return `${formatQuantity(sellable)} ${baseUnit}`;
}

function isPackageSnapshot(snapshot) {
    const code = String(snapshot?.code || '').toLowerCase();
    const symbol = String(snapshot?.symbol || '').toLowerCase();
    const name = String(snapshot?.name || '').toLowerCase();

    return Boolean(snapshot?.package_content_quantity)
        || ['pack', 'package', 'pkg'].includes(code)
        || ['pack', 'package', 'pkg'].includes(symbol)
        || name.includes('package')
        || name.includes('pack');
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
