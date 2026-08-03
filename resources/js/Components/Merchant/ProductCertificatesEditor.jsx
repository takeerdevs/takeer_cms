import React from 'react';
import { CheckCircle2, FileText, Loader2, Plus, ShieldCheck } from 'lucide-react';
import { Button } from '@/Components/ui/Button';
import { Input } from '@/Components/ui/Input';
import { Textarea } from '@/Components/ui/Textarea';
import { useLocale } from '@/lib/i18n';

export default function ProductCertificatesEditor({
    productCertificates,
    selectedProductCertificateIds,
    toggleProductCertificate,
    certificateTypeLabel,
    certificateForm,
    setCertificateForm,
    certificateOwnershipOptions,
    certificateAuthorityOptions,
    saveProductCertificate,
    isSavingCertificate,
}) {
    const { copy } = useLocale();
    return (
        <div className="rounded-2xl border border-blue-100 bg-blue-50/40 p-4 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                <div>
                    <h3 className="text-xs font-black uppercase tracking-wider text-blue-900 flex items-center gap-2">
                        <ShieldCheck className="h-4 w-4" />
                        {copy('Product certificates', 'Vyeti vya bidhaa')}
                    </h3>
                    <p className="mt-1 text-xs text-blue-800">
                        {copy('Attach certificates buyers should see for this item. Private certificates stay hidden.', 'Ambatanisha vyeti ambavyo wanunuzi waone kwa bidhaa hii. Vyeti binafsi vitafichwa.')}
                    </p>
                </div>
                {selectedProductCertificateIds.length > 0 && (
                    <span className="rounded-full bg-white px-3 py-1 text-[10px] font-black uppercase tracking-widest text-blue-700 border border-blue-100">
                        {selectedProductCertificateIds.length} {copy('attached', 'vimeambatanishwa')}
                    </span>
                )}
            </div>

            {productCertificates.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {productCertificates.map((certificate) => {
                        const checked = selectedProductCertificateIds.some((id) => Number(id) === Number(certificate.id));

                        return (
                            <button
                                key={certificate.id}
                                type="button"
                                onClick={() => toggleProductCertificate(certificate.id)}
                                className={`min-h-[74px] rounded-xl border px-3 py-2 text-left transition ${checked ? 'border-blue-500 bg-white text-blue-950 shadow-sm' : 'border-blue-100 bg-white/70 text-slate-700 hover:border-blue-300'}`}
                            >
                                <span className="flex items-start gap-2">
                                    <span className={`mt-0.5 h-5 w-5 rounded-full border flex items-center justify-center ${checked ? 'border-blue-600 bg-blue-600 text-white' : 'border-slate-300 bg-white text-transparent'}`}>
                                        <CheckCircle2 className="h-3.5 w-3.5" />
                                    </span>
                                    <span className="min-w-0">
                                        <span className="block text-sm font-black truncate">{certificate.title}</span>
                                        <span className="mt-0.5 block text-[11px] font-semibold text-slate-500 truncate">
                                            {[
                                                certificateTypeLabel(certificate.certificate_type),
                                                certificate.display_status ? copy(certificate.display_status, { Active: 'Hai', Expired: 'Imeisha', Pending: 'Inasubiri', Revoked: 'Imebatilishwa' }[certificate.display_status] || certificate.display_status) : null,
                                                certificate.visibility === 'public_file' ? copy('file visible', 'faili linaonekana') : certificate.visibility === 'public_summary' ? copy('summary only', 'muhtasari tu') : copy('private', 'binafsi'),
                                            ].filter(Boolean).join(' / ')}
                                        </span>
                                    </span>
                                </span>
                            </button>
                        );
                    })}
                </div>
            ) : (
                <div className="rounded-xl border border-dashed border-blue-200 bg-white/70 px-4 py-3 text-sm font-semibold text-blue-800">
                    {copy('No product certificates yet. Add one below, then it will be attached to this product.', 'Bado hakuna vyeti vya bidhaa. Ongeza kimoja hapa chini, kisha kitaambatanishwa na bidhaa hii.')}
                </div>
            )}

            <div className="rounded-xl border border-blue-100 bg-white p-3 space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <label className="space-y-1.5">
                        <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">{copy('Certificate name', 'Jina la cheti')}</span>
                        <Input
                            placeholder={copy('RoHS, CE, TBS, ISO 9001', 'RoHS, CE, TBS, ISO 9001')}
                            value={certificateForm.title}
                            onChange={(e) => setCertificateForm((current) => ({ ...current, title: e.target.value }))}
                            className="h-11"
                        />
                    </label>
                    <label className="space-y-1.5">
                        <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">{copy('Certificate type', 'Aina ya cheti')}</span>
                        <select
                            value={certificateForm.certificate_type}
                            onChange={(e) => setCertificateForm((current) => ({ ...current, certificate_type: e.target.value }))}
                            className="h-11 w-full rounded-xl border border-input bg-background px-3 text-sm font-semibold"
                        >
                            <option value="">{copy('Select type', 'Chagua aina')}</option>
                            {certificateOwnershipOptions.map((option) => (
                                <option key={option.key} value={option.key}>{copy(option.label, option.swahiliLabel || option.label)}</option>
                            ))}
                        </select>
                    </label>
                    <label className="space-y-1.5">
                        <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">{copy('Certificate number', 'Namba ya cheti')}</span>
                        <Input
                            placeholder={copy('AGC08073250301-C001', 'AGC08073250301-C001')}
                            value={certificateForm.document_number}
                            onChange={(e) => setCertificateForm((current) => ({ ...current, document_number: e.target.value }))}
                            className="h-11"
                        />
                    </label>
                    <label className="space-y-1.5">
                        <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">{copy('Certificate authority', 'Mamlaka ya cheti')}</span>
                        <select
                            value={certificateForm.authority}
                            onChange={(e) => setCertificateForm((current) => ({ ...current, authority: e.target.value }))}
                            className="h-11 w-full rounded-xl border border-input bg-background px-3 text-sm font-semibold"
                        >
                            <option value="">{copy('Select authority', 'Chagua mamlaka')}</option>
                            {certificateAuthorityOptions.map((authority) => (
                                <option key={authority} value={authority}>{authority}</option>
                            ))}
                        </select>
                    </label>
                    <label className="space-y-1.5">
                        <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">{copy('Issuer name', 'Jina la mtoaji')}</span>
                        <Input
                            placeholder={copy('AGC, TBS, SGS Tanzania...', 'AGC, TBS, SGS Tanzania...')}
                            value={certificateForm.issuer}
                            onChange={(e) => setCertificateForm((current) => ({ ...current, issuer: e.target.value }))}
                            className="h-11"
                        />
                    </label>
                    {certificateForm.authority === 'Other' && (
                        <label className="space-y-1.5">
                            <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">{copy('Other authority', 'Mamlaka nyingine')}</span>
                            <Input
                                placeholder={copy('Write authority name', 'Andika jina la mamlaka')}
                                value={certificateForm.issuer}
                                onChange={(e) => setCertificateForm((current) => ({ ...current, issuer: e.target.value }))}
                                className="h-11"
                            />
                        </label>
                    )}
                    <label className="space-y-1.5">
                        <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">{copy('Valid from', 'Inaanza kutumika')}</span>
                        <Input
                            type="date"
                            value={certificateForm.issued_at}
                            onChange={(e) => setCertificateForm((current) => ({ ...current, issued_at: e.target.value }))}
                            className="h-11"
                        />
                    </label>
                    <label className="space-y-1.5">
                        <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">{copy('Valid until', 'Inatumika hadi')}</span>
                        <Input
                            type="date"
                            value={certificateForm.expires_at}
                            onChange={(e) => setCertificateForm((current) => ({ ...current, expires_at: e.target.value }))}
                            className="h-11"
                        />
                    </label>
                </div>
                <Textarea
                    placeholder={copy('Short public explanation, e.g. Complies with EU safety standard', 'Maelezo mafupi ya umma, mf. Inafuata kiwango cha usalama cha EU')}
                    value={certificateForm.description}
                    onChange={(e) => setCertificateForm((current) => ({ ...current, description: e.target.value }))}
                    className="min-h-[72px]"
                />
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    {[
                        { key: 'public_summary', label: copy('Summary only', 'Muhtasari tu') },
                        { key: 'public_file', label: copy('Show file', 'Onyesha faili') },
                        { key: 'private', label: copy('Private', 'Binafsi') },
                    ].map((option) => (
                        <button
                            key={option.key}
                            type="button"
                            onClick={() => setCertificateForm((current) => ({ ...current, visibility: option.key }))}
                            className={`h-10 rounded-xl border text-sm font-black ${certificateForm.visibility === option.key ? 'border-blue-600 bg-blue-600 text-white' : 'border-slate-200 bg-white text-slate-600'}`}
                        >
                            {option.label}
                        </button>
                    ))}
                </div>
                <div className="flex flex-col sm:flex-row gap-2">
                    <label className="h-11 flex-1 rounded-xl border border-dashed border-blue-200 bg-blue-50/70 px-3 text-sm font-bold text-blue-800 flex items-center gap-2 cursor-pointer">
                        <FileText className="h-4 w-4" />
                        <span className="truncate">{certificateForm.document?.name || copy('Upload certificate file', 'Pakia faili la cheti')}</span>
                        <input
                            type="file"
                            accept=".jpg,.jpeg,.png,.webp,.pdf"
                            className="hidden"
                            onChange={(e) => setCertificateForm((current) => ({ ...current, document: e.target.files?.[0] || null }))}
                        />
                    </label>
                    <Button
                        type="button"
                        variant="outline"
                        className="h-11 rounded-xl sm:w-40"
                        onClick={saveProductCertificate}
                        disabled={isSavingCertificate}
                    >
                        {isSavingCertificate ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Plus className="h-4 w-4 mr-1" />}
                        {copy('Add', 'Ongeza')}
                    </Button>
                </div>
            </div>
        </div>
    );
}
