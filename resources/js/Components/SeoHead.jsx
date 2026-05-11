import { Head, usePage } from '@inertiajs/react';
import { useEffect } from 'react';

export default function SeoHead() {
    const { seo } = usePage().props;

    useEffect(() => {
        document.querySelectorAll('[data-takeer-server-seo="true"]').forEach((element) => {
            element.remove();
        });
    }, [seo]);

    if (!seo) return null;

    const schemas = Array.isArray(seo.structured_data) ? seo.structured_data : [];

    return (
        <Head>
            {seo.title && <title>{seo.title}</title>}
            {seo.description && <meta head-key="description" name="description" content={seo.description} />}
            {seo.robots && <meta head-key="robots" name="robots" content={seo.robots} />}
            {seo.canonical && <link head-key="canonical" rel="canonical" href={seo.canonical} />}
            {seo.title && <meta head-key="og:title" property="og:title" content={seo.title} />}
            {seo.description && <meta head-key="og:description" property="og:description" content={seo.description} />}
            {seo.type && <meta head-key="og:type" property="og:type" content={seo.type} />}
            {seo.canonical && <meta head-key="og:url" property="og:url" content={seo.canonical} />}
            {seo.site_name && <meta head-key="og:site_name" property="og:site_name" content={seo.site_name} />}
            {seo.image && <meta head-key="og:image" property="og:image" content={seo.image} />}
            <meta head-key="twitter:card" name="twitter:card" content={seo.twitter_card || (seo.image ? 'summary_large_image' : 'summary')} />
            {seo.title && <meta head-key="twitter:title" name="twitter:title" content={seo.title} />}
            {seo.description && <meta head-key="twitter:description" name="twitter:description" content={seo.description} />}
            {seo.image && <meta head-key="twitter:image" name="twitter:image" content={seo.image} />}
            {schemas.map((schema, index) => (
                <script
                    key={`schema-${index}`}
                    head-key={`schema-${index}`}
                    type="application/ld+json"
                    dangerouslySetInnerHTML={{ __html: JSON.stringify(schema).replace(/</g, '\\u003C') }}
                />
            ))}
        </Head>
    );
}
