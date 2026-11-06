import SiteDocument from '../site-document';
export { metadata } from '../site-document';
export default function Layout({children}:{children:React.ReactNode}) { return <SiteDocument>{children}</SiteDocument>; }
