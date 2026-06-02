import React from 'react';
import { CheckCircle2, Search, ShoppingBag } from 'lucide-react';
import { Input } from '@/Components/ui/Input';

export default function ServiceRelatedProductsEditor({
    isLoadingProducts,
    physicalMerchantProducts,
    filteredPhysicalMerchantProducts,
    visiblePhysicalMerchantProducts,
    serviceProductSearch,
    setServiceProductSearch,
    serviceRelatedProductIds,
    toggleServiceRelatedProduct,
}) {
    return (
        <div className="rounded-2xl border p-3 sm:p-4 space-y-3">
            <div>
                <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Products made or used with this service</label>
                <p className="text-xs text-muted-foreground mt-1">
                    Optional. Search and attach published products you make, bring, install, or commonly sell with this service.
                </p>
            </div>
            {isLoadingProducts ? (
                <div className="rounded-xl border border-dashed bg-slate-50/60 px-4 py-3 text-xs text-muted-foreground">
                    Loading your products...
                </div>
            ) : physicalMerchantProducts.length === 0 ? (
                <div className="rounded-xl border border-dashed bg-slate-50/60 px-4 py-3 text-xs text-muted-foreground">
                    No published physical products yet. Publish products first, then attach them here.
                </div>
            ) : (
                <div className="space-y-3">
                    <label className="relative block">
                        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                        <Input
                            placeholder="Search published products..."
                            value={serviceProductSearch}
                            onChange={(e) => setServiceProductSearch(e.target.value)}
                            className="h-11 pl-9 text-sm"
                        />
                    </label>
                    {visiblePhysicalMerchantProducts.length === 0 ? (
                        <div className="rounded-xl border border-dashed bg-slate-50/60 px-4 py-3 text-xs text-muted-foreground">
                            No published products match this search.
                        </div>
                    ) : (
                        <>
                            <div className="flex items-center justify-between gap-2 text-[11px] font-bold text-muted-foreground">
                                <span>
                                    Showing {visiblePhysicalMerchantProducts.length} of {filteredPhysicalMerchantProducts.length} published product{filteredPhysicalMerchantProducts.length === 1 ? '' : 's'}
                                </span>
                                {filteredPhysicalMerchantProducts.length > 10 && (
                                    <span>Refine search to see more</span>
                                )}
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                {visiblePhysicalMerchantProducts.map((item) => {
                                    const selected = serviceRelatedProductIds.includes(Number(item.id));

                                    return (
                                        <button
                                            key={item.id}
                                            type="button"
                                            onClick={() => toggleServiceRelatedProduct(item.id)}
                                            className={`rounded-xl border p-2 text-left transition-colors ${selected ? 'border-purple-400 bg-purple-50 ring-1 ring-purple-100' : 'border-slate-200 bg-white hover:border-purple-200'}`}
                                        >
                                            <div className="flex items-center gap-3">
                                                <div className="h-12 w-12 shrink-0 overflow-hidden rounded-lg bg-slate-100">
                                                    {item.image_url ? (
                                                        <img src={item.image_url} alt="" className="h-full w-full object-cover" />
                                                    ) : (
                                                        <ShoppingBag className="mx-auto mt-3 h-5 w-5 text-slate-300" />
                                                    )}
                                                </div>
                                                <div className="min-w-0 flex-1">
                                                    <p className="truncate text-sm font-black text-slate-900">{item.title}</p>
                                                    <p className="text-[11px] font-semibold text-muted-foreground">
                                                        TZS {Number(item.checkout_price ?? item.discounted_price ?? item.price ?? 0).toLocaleString()}
                                                    </p>
                                                </div>
                                                <CheckCircle2 className={`h-5 w-5 shrink-0 ${selected ? 'fill-purple-600 text-white' : 'text-slate-300'}`} />
                                            </div>
                                        </button>
                                    );
                                })}
                            </div>
                        </>
                    )}
                </div>
            )}
            {serviceRelatedProductIds.length > 0 && (
                <p className="text-[11px] font-bold text-purple-700">
                    {serviceRelatedProductIds.length} product{serviceRelatedProductIds.length === 1 ? '' : 's'} attached to this service.
                </p>
            )}
        </div>
    );
}
