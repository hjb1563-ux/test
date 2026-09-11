export type Choice={id:string;name:string;sub:string;image:string};
export type ChoiceGroup={key:string;title:string;multiple?:boolean;choices:Choice[]};
export type BathroomStep={key:string;title:string;question:string;guide:string;groups:ChoiceGroup[]};
const image=(folder:string)=>`/images/bathroom-builder/${folder}/placeholder.jpg`;
const undecided=(folder:string):Choice=>({id:'undecided',name:'아직 모르겠어요',sub:'상담하며 결정할게요',image:image(folder)});
const group=(key:string,title:string,folder:string,items:string[],multiple=false):ChoiceGroup=>({key,title,multiple,choices:[...items.map(item=>{const [id,name,sub=''] = item.split('|');return{id,name,sub,image:image(folder)}}),undecided(folder)]});
const step=(key:string,title:string,question:string,guide:string,groups:ChoiceGroup[]):BathroomStep=>({key,title,question,guide,groups});
export const bathroomSteps:BathroomStep[]=[
 step('demolition','철거 vs 덧방','어떤 방식으로 욕실을 새롭게 만들고 싶으세요?','demolition',[group('demolition','시공 방식','demolition',['overlay|덧방|기존 타일 위에 새 타일을 시공해요.','partial-demolition-overlay|부분 철거 + 덧방|필요한 부분만 정리해요.','full-demolition|전체 철거|바탕부터 새롭게 확인해요.']),group('bathroomCondition','현재 욕실 상태','demolition',['cracked|기존 타일이 깨져 있어요','loose|기존 타일이 들떠 있어요','leak|누수 이력이 있어요','remove-bath|욕조를 철거하고 싶어요','unknown-condition|현재 상태를 잘 모르겠어요'],true)]),
 step('layout','구조 변경','욕실 공간을 어떻게 사용하고 싶으세요?','layout',[group('jendai','젠다이','structure',['none|없음','keep|기존 젠다이 유지','new|젠다이 신설','remove|기존 젠다이 철거','sink-ledger|세면대 젠다이','toilet-ledger|변기 젠다이','shower-ledger|샤워공간 젠다이']),group('partition','파티션','structure',['none|없음','half-partition|하프 파티션|개방감과 물튐 감소의 균형','full-partition|전체 파티션|공간을 또렷하게 나눠요']),group('showerBooth','샤워부스','structure',['none|없음','fixed-glass|고정 유리','door-booth|도어형']),group('niche','니치','structure',['none|없음','shower-niche|샤워 니치','sink-niche|세면대 니치','wall-niche|일반 벽면 니치']),group('concealed','매립 설비','structure',['concealed-basin|매립 세면 수전','concealed-shower|매립 샤워 수전','concealed-bath|매립 욕조 수전','concealed-paper|매립 휴지걸이','none|사용하지 않음'],true)]),
 step('waterproofing','방수','방수 방식은 현장 상태와 함께 확인해보세요.','waterproofing',[group('waterproofing','방수 방식','waterproofing',['liquid-waterproofing|액방|시멘트계 액체 방수 방식','coating-waterproofing|도막 방수|연속적인 방수층을 만들어요.','combined-waterproofing|액방 + 도막|두 공정을 함께 사용해요.','consult|업체와 상담 후 결정'])]),
 step('tile','타일','사진을 보며 가장 마음에 드는 타일 분위기를 골라보세요.','tile',[group('wallTileSize','벽 타일 크기','tile',['300x600|300×600|균형감 있는 기본 비율','600x600|600×600|정돈되고 모던한 느낌','600x1200|600×1200|줄눈이 적고 넓어 보여요','other|기타 타일']),group('floorTileSize','바닥 타일 크기','tile',['300x600|300×600','600x600|600×600','600x1200|600×1200','other|기타 타일']),group('tile','타일 분위기','tile',['white|화이트','ivory|아이보리','gray|그레이','dark|다크']),group('tileSurface','표면','tile',['matte|무광','glossy|유광']),group('window','욕실 창문','tile',['yes|있음','no|없음'])]),
 step('basin','세면대','세면대가 설치된 실제 욕실 모습을 상상하며 골라보세요.','basin',[group('sink','세면대','basin',['vanity-basin|일반 세면대','top-bowl|볼 세면대','undermount-basin|언더볼 세면대'])]),
 step('toilet','변기','욕실에서 가장 자주 마주하는 형태를 골라보세요.','toilet',[group('toilet','변기','toilet',['one-piece|원피스','two-piece|투피스','wall-hung|벽걸이형'])]),
 step('furniture','욕실장 & 거울','수납과 거울의 인상을 간결하게 정리해보세요.','furniture',[group('cabinet','욕실장','cabinet',['sliding-mirror|슬라이딩 거울장','led-cabinet|LED 거울장','none|욕실장 없음']),group('mirror','거울','cabinet',['mirror|일반 거울','led-mirror|LED 거울','none|거울 없음'])]),
 step('bathtub','욕조','욕조가 놓인 모습을 보고 원하는 사용 방식을 골라보세요.','bathtub',[group('bathtub','욕조 종류','bathtub',['bath-standard|일반 욕조','bath-masonry|조적 욕조','bath-half-body|반신욕 욕조'])]),
 step('ceiling','천장','욕실의 전체 인상을 만드는 천장 마감을 골라보세요.','ceiling',[group('ceiling','천장','ceiling',['smc-flat|SMC 평천장','smc-dome|SMC 돔천장'])]),
 step('faucet','수전 & 샤워','매일 쓰는 수전과 샤워의 사용감을 정리해보세요.','faucet',[group('faucet','세면 수전','faucet',['one-hole|일반 수전','concealed|매립 세면 수전','tall|볼 세면대용 높은 수전']),group('showerFaucet','샤워 수전','faucet',['shower|일반 샤워수전','bath|욕조 겸용','hand-shower|핸드 샤워','concealed-shower|매립 샤워'],true)]),
 step('drainage','배수 & 구배','배수 방식은 마감 모습과 관리 편의를 함께 살펴보세요.','drainage',[group('drain','배수구','drainage',['square-drain|일반 사각 배수구','tile-drain|타일 삽입형 배수구','linear-drain|라인 배수구','trench-drain|트렌치 드레인']),group('drainPosition','배수 위치','drainage',['keep|현재 위치 유지','move|변경 예정'])]),
 step('ventilation','환기 & 건조','환기와 건조 기능은 생활 패턴에 맞춰 복수 선택하세요.','ventilation',[group('ventilation','환기 & 건조','ventilation',['fan|기본 환기','strong-fan|강한 환기','dehumidify|제습 기능','dry|건조 기능','heater|온풍 기능'],true)]),
 step('lighting','조명 & 전기','빛의 위치에 따라 달라지는 욕실 분위기를 골라보세요.','lighting',[group('lighting','조명','lighting',['light-recessed|천장 매립 조명','indirect|천장 간접 조명','cabinet-indirect|욕실장 간접 조명'],true)]),
 step('accessories','액세서리','금속 마감과 필요한 소품을 골라보세요.','accessories',[group('accessoryFinish','액세서리 마감','accessories',['chrome|크롬','nickel|니켈']),group('accessory','액세서리 종류','accessories',['paper-holder|휴지걸이','towel-bar|수건걸이','soap-holder|비누걸이','cup|컵','corner-shelf|코너 선반','straight-shelf|일자 선반'],true)]),
 step('grout','줄눈','타일 사이의 마감 방식도 함께 선택해보세요.','grout',[group('grout','줄눈','grout',['grout-cement|시멘트 줄눈','grout-epoxy|에폭시 줄눈','grout-elastic|탄성 줄눈'])]),
 step('threshold','욕실 문틀 하부 / 문턱','욕실과 바깥 공간이 만나는 마감을 골라보세요.','threshold',[group('threshold','문턱 마감','threshold',['threshold-tile|타일 마감','threshold-artificial-stone|인조대리석 마감'])]),
 step('checklist','최종 확인','지금까지 고른 내용을 상담 전에 확인해보세요.','checklist',[])
];
export const defaultBathroomValues:Record<string,string|string[]>={};
export const stepForKey=Object.fromEntries(bathroomSteps.map(item=>[item.key,item]));
