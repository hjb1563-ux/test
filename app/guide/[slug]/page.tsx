import { notFound } from 'next/navigation';
import GuideDetail from '../../../components/GuideDetail';
import { guideBySlug, guides } from '../../../data/guides/catalog';
export function generateStaticParams(){return guides.map(guide=>({slug:guide.slug}))}
export default async function Detail({params}:{params:Promise<{slug:string}>}){const {slug}=await params;const guide=guideBySlug[slug];if(!guide)notFound();const index=guides.findIndex(item=>item.slug===guide.slug);return <GuideDetail guide={guide} previous={guides[index-1]} next={guides[index+1]}/>}
