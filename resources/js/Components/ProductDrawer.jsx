import React from 'react';
import {
    Drawer,
    DrawerContent,
    DrawerHeader,
    DrawerTitle,
    DrawerDescription,
    DrawerFooter
} from '@/Components/ui/Drawer';
import { Button } from '@/Components/ui/Button';
import { ShieldCheck, Truck, ArrowRight, Zap, DownloadCloud, CalendarClock, Link as LinkIcon } from 'lucide-react';
import { useLocale } from '@/lib/i18n';

export default function ProductDrawer({ product, isOpen, onOpenChange, onCheckout }) {
    const { copy } = useLocale();
    if (!product) return null;

    const isDigital = product.type === 'digital';
    const isService = product.type === 'service';
    const isPhysical = !product.type || product.type === 'physical';

    return (
        <Drawer open={isOpen} onOpenChange={onOpenChange}>
            <DrawerContent className="max-h-[90vh]">
                <div className="overflow-y-auto no-scrollbar pb-6 px-4">

                    <DrawerHeader className="px-0 pt-2 pb-4 border-b">
                        <div className="flex justify-between items-start gap-4">
                            <div>
                                <div className="flex items-center gap-2 mb-1.5">
                                    {isDigital && (
                                        <span className="bg-brand-100 text-brand-700 text-[10px] font-black px-2 py-0.5 rounded-full flex items-center gap-1 w-max uppercase tracking-widest">
                                            <DownloadCloud className="h-3 w-3" /> {copy('Digital', 'Mtandaoni')}
                                        </span>
                                    )}
                                    {isService && (
                                        <span className="bg-purple-100 text-purple-700 text-[10px] font-black px-2 py-0.5 rounded-full flex items-center gap-1 w-max uppercase tracking-widest">
                                            <CalendarClock className="h-3 w-3" /> {copy('Service / booking', 'Huduma / booking')}
                                        </span>
                                    )}
                                </div>
                                <DrawerTitle className="text-xl font-bold leading-tight">
                                    {product.title}
                                </DrawerTitle>
                                <DrawerDescription className="mt-1 flex items-center gap-1.5 text-brand-600 font-medium">
                                    <ShieldCheck className="h-4 w-4" />
                                    {copy('Seller', 'Muuzaji')}: {product.merchant?.name || copy('Takeer Verified', 'Takeer amethibitishwa')}
                                </DrawerDescription>
                            </div>
                            <div className="text-right shrink-0">
                                <p className="text-2xl font-black text-foreground">
                                    <span className="text-sm font-normal text-muted-foreground mr-1">TZS</span>
                                    {Number(product.price).toLocaleString()}
                                </p>
                                {product.compare_at_price > product.price && (
                                    <p className="text-xs text-muted-foreground line-through opacity-70">
                                        TZS {Number(product.compare_at_price).toLocaleString()}
                                    </p>
                                )}
                                {product.in_stock ? (
                                    <span className="inline-flex items-center rounded-sm bg-green-100 px-2 py-0.5 mt-1 text-xs font-medium text-green-800">
                                        {copy('In stock', 'Ipo stoo')}
                                    </span>
                                ) : (
                                    <span className="inline-flex items-center rounded-sm bg-red-100 px-2 py-0.5 mt-1 text-xs font-medium text-red-800">
                                        {copy('Sold out', 'Imeisha')}
                                    </span>
                                )}
                            </div>
                        </div>
                    </DrawerHeader>

                    {/* Product Details Section */}
                    <div className="py-6 space-y-6">

                        {/* Attributes Grid */}
                        {product.attributes && (
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-1">
                                    <p className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">{copy('Category', 'Kategoria')}</p>
                                    <p className="font-medium">{product.attributes.category} • {product.attributes.sub_category}</p>
                                </div>
                                <div className="space-y-1">
                                    <p className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">{copy('Color', 'Rangi')}</p>
                                    <div className="flex gap-1.5 flex-wrap">
                                        {product.attributes.colors?.map(c => (
                                            <span key={c} className="inline-block px-2 py-1 bg-accent rounded-md text-xs">{c}</span>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Description */}
                        <div className="space-y-2">
                            <p className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">{copy('Description', 'Maelezo')}</p>
                            <p className="text-sm leading-relaxed text-foreground/90">
                                {product.attributes?.suggested_description || copy('Quality product at a fair price. Pay securely through the available PSP method.', 'Bidhaa bora kwa bei nafuu. Lipia sasa kupitia njia salama ya PSP.')}
                            </p>
                        </div>

                        {/* Trust Badges */}
                        <div className="rounded-xl border bg-brand-50/50 p-4 space-y-3">
                            <div className="flex items-start gap-3">
                                <div className="p-2 bg-brand-100 rounded-lg text-brand-600 shrink-0">
                                    <ShieldCheck className="h-5 w-5" />
                                </div>
                                <div>
                                    <p className="text-sm font-bold text-brand-900">{copy('Order protection (PSP)', 'Uhakika wa order (PSP)')}</p>
                                    <p className="text-xs text-brand-700/80 mt-0.5 leading-snug">
                                        {isPhysical ? 
                                            copy('Takeer holds your payment. The seller is not paid until delivery is confirmed.', 'Pesa yako inahifadhiwa Takeer. Muuzaji hapokei pesa mpaka uthibitishe kupokea mzigo.') :
                                            copy(`You will receive a ${isDigital ? 'download' : 'booking'} link as soon as payment is complete.`, `Utapewa link ya ${isDigital ? 'kupakua' : 'kufanya booking'} mara tu baada ya malipo kukamilika.`)
                                        }
                                    </p>
                                </div>
                            </div>
                            
                            {isPhysical ? (
                                <div className="flex items-start gap-3">
                                    <div className="p-2 bg-amber-100 rounded-lg text-amber-600 shrink-0">
                                        <Truck className="h-5 w-5" />
                                    </div>
                                    <div>
                                        <p className="text-sm font-bold text-amber-900">{copy('Dispatch within 24 hours', 'Usafirishaji ndani ya masaa 24')}</p>
                                        <p className="text-xs text-amber-700/80 mt-0.5 leading-snug">
                                            {copy('Your order will be sent by local rider or inter-city bus where applicable.', 'Mzigo utatumwa kupitia Boda Boda (ndani ya mkoa) au Basi (mikoani).')}
                                        </p>
                                    </div>
                                </div>
                            ) : (
                                <div className="flex items-start gap-3">
                                    <div className="p-2 bg-blue-100 rounded-lg text-blue-600 shrink-0">
                                        <LinkIcon className="h-5 w-5" />
                                    </div>
                                    <div>
                                        <p className="text-sm font-bold text-blue-900">{copy('Fast access', 'Upatikanaji wa haraka')}</p>
                                        <p className="text-xs text-blue-700/80 mt-0.5 leading-snug">
                                            {copy('No waiting required. Access your digital product or service after payment.', 'Huna haja ya kusubiri. Pata huduma yako mara moja kidijitali.')}
                                        </p>
                                    </div>
                                </div>
                            )}
                        </div>

                    </div>
                </div>

                <DrawerFooter className="pt-2 border-t bg-background sticky bottom-0">
                    <Button
                        size="lg"
                        className="w-full h-14 rounded-xl text-lg relative overflow-hidden group"
                        disabled={!product.in_stock}
                        onClick={() => onCheckout(product)}
                    >
                        {/* Shimmer effect */}
                        <span className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:animate-[shimmer_1.5s_infinite]" />

                        {product.in_stock ? (
                            <span className="flex items-center gap-2">
                                <Zap className="h-5 w-5" />
                                {copy('Buy with 1-Tap through PSP', 'Nunua na 1-Tap kupitia PSP')}
                                <ArrowRight className="h-5 w-5 ml-1" />
                            </span>
                        ) : (
                            copy('Sold out', 'Imeisha')
                        )}
                    </Button>
                </DrawerFooter>
            </DrawerContent>
        </Drawer>
    );
}
