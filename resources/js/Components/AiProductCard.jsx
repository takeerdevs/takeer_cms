import React from 'react';
import { ArrowUpRight, ShoppingBag, Star, Store } from 'lucide-react';
import { useLocale } from '@/lib/i18n';

const formatMoney = (value, currency = 'TZS') => {
    const amount = Number(value);
    if (!Number.isFinite(amount)) return null;
    try {
        return new Intl.NumberFormat('sw-TZ', {
            style: 'currency',
            currency,
            maximumFractionDigits: 0,
        }).format(amount);
    } catch {
        return `${currency} ${amount.toLocaleString()}`;
    }
};

export default function AiProductCard({ product, onView, onBuy }) {
    const { copy } = useLocale();
    const image = product?.image_url || product?.images?.[0]?.url;
    const price = formatMoney(product?.checkout_price ?? product?.price, product?.currency_code || 'TZS');
    const merchantName = product?.merchant?.name || product?.merchant?.username;
    const rating = Number(product?.rating_average);

    return (
        <article className="group flex w-[238px] shrink-0 flex-col overflow-hidden rounded-[22px] border border-slate-200/80 bg-white shadow-[0_12px_35px_-22px_rgba(15,23,42,0.45)] transition hover:-translate-y-0.5 hover:shadow-[0_18px_40px_-22px_rgba(15,23,42,0.5)]">
            <button type="button" onClick={() => onView?.(product)} className="relative block aspect-[1.08] overflow-hidden bg-slate-100 text-left">
                {image ? (
                    <img src={image} alt={product?.title || ''} className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.04]" />
                ) : (
                    <div className="flex h-full items-center justify-center bg-[radial-gradient(circle_at_25%_20%,#dbeafe,transparent_48%),linear-gradient(135deg,#e2e8f0,#f8fafc)]">
                        <ShoppingBag className="h-9 w-9 text-slate-400" />
                    </div>
                )}
                <span className="absolute left-3 top-3 rounded-full bg-white/90 px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.14em] text-slate-700 shadow-sm backdrop-blur">
                    {product?.in_stock === false ? copy('Unavailable', 'Haipo') : copy('In stock', 'Ipo')}
                </span>
            </button>

            <div className="flex flex-1 flex-col p-3.5">
                <h3 className="line-clamp-2 min-h-[2.5rem] text-sm font-extrabold leading-5 text-slate-950">{product?.title || copy('Takeer product', 'Bidhaa ya Takeer')}</h3>
                <div className="mt-2 flex items-center justify-between gap-2">
                    <span className="text-sm font-black text-slate-950">{price || copy('View price', 'Angalia bei')}</span>
                    {Number.isFinite(rating) && rating > 0 && (
                        <span className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-600"><Star className="h-3 w-3 fill-current" /> {rating.toFixed(1)}</span>
                    )}
                </div>
                {merchantName && (
                    <p className="mt-1.5 flex items-center gap-1 truncate text-[11px] font-medium text-slate-500"><Store className="h-3 w-3 shrink-0" /> {merchantName}</p>
                )}
                <div className="mt-3 grid grid-cols-2 gap-2">
                    <button type="button" onClick={() => onView?.(product)} className="inline-flex items-center justify-center gap-1 rounded-xl border border-slate-200 px-2 py-2 text-xs font-extrabold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50">
                        {copy('View', 'Angalia')} <ArrowUpRight className="h-3.5 w-3.5" />
                    </button>
                    <button type="button" disabled={product?.in_stock === false} onClick={() => onBuy?.(product)} className="inline-flex items-center justify-center gap-1 rounded-xl bg-slate-950 px-2 py-2 text-xs font-extrabold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-400">
                        {copy('Buy', 'Nunua')} <ShoppingBag className="h-3.5 w-3.5" />
                    </button>
                </div>
            </div>
        </article>
    );
}
