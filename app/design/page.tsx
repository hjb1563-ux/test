import { Suspense } from 'react'; import Configurator from '../../components/Configurator';
export default function Design(){return <Suspense fallback={<main className="design">설계 도구를 불러오는 중입니다.</main>}><Configurator/></Suspense>}
