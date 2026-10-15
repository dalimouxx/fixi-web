import { randomUUID } from 'node:crypto';
import { PrismaClient, UserRole, DeviceCategory, SubscriptionStatus, AutomationTrigger, AutomationAction, DocumentType, DurationUnit, AcademyLevel, RepairStatus } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  const platformLogin = process.env.PLATFORM_ADMIN_LOGIN || 'platform';
  const platformPassword = process.env.PLATFORM_ADMIN_PASSWORD || 'ChangeMe-Fixi-2026!';
  const initialShopSlug = (process.env.INITIAL_SHOP_SLUG || 'atelier-principal').toLowerCase();
  const initialShopName = process.env.INITIAL_SHOP_NAME || 'Mon Atelier';
  const initialShopRegion = process.env.INITIAL_SHOP_REGION || 'Gabès';
  const initialAdminLogin = (process.env.INITIAL_ADMIN_LOGIN || 'admin').toLowerCase();
  const initialAdminPin = process.env.INITIAL_ADMIN_PIN || '482731';

  const platformHash = await bcrypt.hash(platformPassword, 12);
  await prisma.platformAdmin.upsert({
    where: { login: platformLogin },
    update: {},
    create: { login: platformLogin, fullName: 'Fixi Platform Admin', passwordHash: platformHash },
  });

  const starter = await prisma.plan.upsert({
    where: { code: 'STARTER' },
    update: {},
    create: { code: 'STARTER', name: 'Starter', description:'Pour démarrer avec Fixi', priceMonthly: 39, price:39, durationValue:1, durationUnit:DurationUnit.MONTH, publicVisible:true, maxShops: 1, maxUsersPerShop: 5, features: { repairs: true, cashier: true, stock: true } },
  });
  await prisma.plan.upsert({
    where: { code: 'PRO' },
    update: {},
    create: { code: 'PRO', name: 'Pro', description:'Atelier professionnel avec facturation et rapports', priceMonthly: 69, price:69, durationValue:1, durationUnit:DurationUnit.MONTH, publicVisible:true, maxShops: 3, maxUsersPerShop: 15, features: { repairs: true, cashier: true, stock: true, warranty: true, documents: true, reports: true } },
  });
  await prisma.plan.upsert({
    where: { code: 'BUSINESS' },
    update: {},
    create: { code: 'BUSINESS', name: 'Business', description:'Réseau et fonctions avancées', priceMonthly: 119, price:119, durationValue:1, durationUnit:DurationUnit.MONTH, publicVisible:true, maxShops: 10, maxUsersPerShop: 50, features: { all: true } },
  });

  for (const code of ['STARTER','PRO','BUSINESS']) {
    const plan=await prisma.plan.findUnique({where:{code}});
    if(plan && Number(plan.price)===0 && Number(plan.priceMonthly)>0) await prisma.plan.update({where:{id:plan.id},data:{price:plan.priceMonthly,durationValue:1,durationUnit:DurationUnit.MONTH,publicVisible:true}});
  }

  let shop = await prisma.shop.findUnique({ where: { slug: initialShopSlug } });
  if (!shop) {
    const tenant = await prisma.tenant.create({ data: { name: initialShopName } });
    shop = await prisma.shop.create({
      data: {
        tenantId: tenant.id,
        name: initialShopName,
        slug: initialShopSlug,
        region: initialShopRegion,
        countryCode: '216',
        currency: 'DT',
      },
    });
    await prisma.subscription.create({ data: { tenantId: tenant.id, planId: starter.id, status: SubscriptionStatus.ACTIVE } });
  } else {
    if (!shop.region || shop.region === 'Non classée') shop = await prisma.shop.update({ where: { id: shop.id }, data: { region: initialShopRegion } });
    const existingSub = await prisma.subscription.findFirst({ where: { tenantId: shop.tenantId } });
    if (!existingSub) await prisma.subscription.create({ data: { tenantId: shop.tenantId, planId: starter.id, status: SubscriptionStatus.ACTIVE } });
  }

  const admin = await prisma.user.findUnique({ where: { shopId_loginCode: { shopId: shop.id, loginCode: initialAdminLogin } } });
  if (!admin) {
    const pinHash = await bcrypt.hash(initialAdminPin, 12);
    await prisma.user.create({
      data: {
        shopId: shop.id,
        loginCode: initialAdminLogin,
        fullName: 'Administrateur',
        role: UserRole.ADMIN,
        pinHash,
        isActive: true,
        mustChangePin: true,
      },
    });
  }

  const types: Array<[string, DeviceCategory, boolean, number | null]> = [
    ['Écran cassé', DeviceCategory.PHONE, false, null],
    ['Batterie', DeviceCategory.PHONE, false, null],
    ['Connecteur de charge', DeviceCategory.PHONE, false, null],
    ['Diagnostic PC', DeviceCategory.COMPUTER, false, null],
  ];
  for (const [name, category, isFixedPrice, fixedPrice] of types) {
    const exists = await prisma.repairType.findFirst({ where: { shopId: shop.id, name, category } });
    if (!exists) await prisma.repairType.create({ data: { shopId: shop.id, name, category, isFixedPrice, fixedPrice } });
  }

  await prisma.platformSettings.upsert({ where:{id:'platform'}, update:{}, create:{id:'platform',appName:'Fixi',primaryColor:'#FF6B00'} });

  const oldQuotes=await prisma.salesDocument.findMany({where:{type:DocumentType.QUOTE,publicToken:null},select:{id:true}});
  for(const q of oldQuotes)await prisma.salesDocument.update({where:{id:q.id},data:{publicToken:randomUUID().replace(/-/g,'')}});

  const automations = [
    ['Smart Assign', AutomationTrigger.REPAIR_CREATED, AutomationAction.ASSIGN_TECHNICIAN, 5],
    ['Relance appareil prêt 72h', AutomationTrigger.READY_OVERDUE, AutomationAction.WHATSAPP_SUGGESTION, 4320],
    ['Alerte stock faible', AutomationTrigger.LOW_STOCK, AutomationAction.NOTIFICATION, 0],
    ['Écart de caisse', AutomationTrigger.CASH_DIFFERENCE, AutomationAction.NOTIFICATION, 0],
  ] as const;
  const allShops=await prisma.shop.findMany({select:{id:true}});
  for (const targetShop of allShops) {
    for (const [name,trigger,action,delayMinutes] of automations) {
      const exists=await prisma.automationRule.findFirst({where:{shopId:targetShop.id,name}});
      if(!exists)await prisma.automationRule.create({data:{shopId:targetShop.id,name,trigger,action,delayMinutes,enabled:true}});
    }
  }

  const catalog: Record<string,string[]> = {
    Apple: ['iPhone 8','iPhone SE 2020','iPhone SE 2022','iPhone X','iPhone XR','iPhone 11','iPhone 11 Pro','iPhone 12','iPhone 12 Pro','iPhone 13','iPhone 13 Pro','iPhone 14','iPhone 14 Pro','iPhone 15','iPhone 15 Pro','iPhone 16','iPhone 16 Pro'],
    Samsung: ['Galaxy A04','Galaxy A05','Galaxy A12','Galaxy M12','Galaxy A32 5G','Galaxy A13','Galaxy A14','Galaxy A15','Galaxy A22','Galaxy A23','Galaxy A24','Galaxy A25','Galaxy A32','Galaxy A33','Galaxy A34','Galaxy A35','Galaxy A52','Galaxy A53','Galaxy A54','Galaxy A55','Galaxy S21','Galaxy S22','Galaxy S23','Galaxy S24','Galaxy S24 Ultra'],
    Xiaomi: ['Redmi 9A','Redmi 9C','Redmi 10A','Redmi 10','Redmi 12','Redmi 13','Redmi Note 10','Redmi Note 10 5G','Redmi Note 10T 5G','Redmi Note 11','Redmi Note 12','Redmi Note 13','Poco M3 Pro 5G','Poco X3','Poco X5','Poco X6'],
    Oppo: ['A16','A16s','A17','A18','A54','A54s','A57','A58','A74','A78','Reno 8','Reno 10'],
    Infinix: ['Smart 5','Smart 6','Smart 7','Smart 8','Hot 9 Play','Hot 10','Hot 10 Lite','Hot 10 Play','Hot 11','Hot 12','Hot 20','Hot 30','Hot 40'],
    Tecno: ['Pop 7','Pop 7 Pro','Spark Go 2020','Spark Go 2023','Spark 6 Go','Spark 7','Spark 8','Spark 9','Spark 10','Spark 10C','Spark 20','Camon 18','Camon 19','Camon 20'],
    itel: ['A49','A60','A70','P40','P55','S23'],
    Realme: ['C11 2020','C12','C15','C21','C25','C30','C33','C53','C55','C67','8','9','10'],
    Huawei: ['Y6p'],
    Honor: ['9A']
  };
  for (const [brandName,models] of Object.entries(catalog)) {
    const brand=await prisma.deviceBrand.upsert({where:{name:brandName},update:{active:true},create:{name:brandName,active:true}});
    for(const modelName of models) await prisma.deviceModel.upsert({where:{brandId_name:{brandId:brand.id,name:modelName}},update:{active:true},create:{brandId:brand.id,name:modelName,category:DeviceCategory.PHONE}});
  }

  // Pack de compatibilités documentées. "VERIFIED" = vérifiée par source,
  // "tested" reste false tant qu'un atelier Fixi n'a pas réalisé un test physique.
  const checkedAt=new Date('2026-10-15T00:00:00.000Z');
  const compatibilitySeeds = [
    {
      partReference:'IFIXIT-IF435-000-3',
      partName:'Afficheur iPhone 8 / SE 2020 / SE 2022',
      partType:'DISPLAY',
      sourceName:'iFixit',
      sourceUrl:'https://www.ifixit.com/products/iphone-se-2020-screen',
      note:'iFixit indique que l’écran SE 2020/SE 2022 est compatible iPhone 8. Transférer le bouton Home original pour conserver Touch ID.',
      models:[['Apple','iPhone 8'],['Apple','iPhone SE 2020'],['Apple','iPhone SE 2022']]
    },
    {
      partReference:'REALME-A03559-XX',
      partName:'Afficheur Realme C11 2020 / C12 / C15 / C25',
      partType:'DISPLAY',
      sourceName:'cPix',
      sourceUrl:'https://cpix.fr/realme-serie-c/6040-ecran-realme-c11-2020-c12-c15-c25.html',
      note:'Compatibilité annoncée pour RMX2185 / RMX2189 / RMX2180 / RMX3193-RMX3191. Tester image et tactile avant collage.',
      models:[['Realme','C11 2020'],['Realme','C12'],['Realme','C15'],['Realme','C25']]
    },
    {
      partReference:'LCD-SPARK6GO-SMART5-FAMILY',
      partName:'Afficheur Spark Go 2020 / Spark 6 Go / Hot 10 Lite / Smart 5',
      partType:'DISPLAY',
      sourceName:'ORIWHIZ',
      sourceUrl:'https://oriwhiz.com/fr-fr/products/original-lcd-screen-and-digitizer-full-assembly-for-tecno-spark-go-2020-spark-6-go-infinix-hot-10-lite-infinix-smart-5-for-tecno-spark-go-2020original',
      note:'Même famille d’écran listée pour quatre modèles. Comparer nappe, connecteur et révision avant montage définitif.',
      models:[['Tecno','Spark Go 2020'],['Tecno','Spark 6 Go'],['Infinix','Hot 10 Lite'],['Infinix','Smart 5']]
    },
    {
      partReference:'BL-58BX',
      partName:'Batterie Infinix BL-58BX 6000 mAh',
      partType:'BATTERY',
      sourceName:'Sunsky',
      sourceUrl:'https://www.sunsky-online.com/fr/p/EDA006116602/Batterie-de-remplacement-pour-Infinix-Hot-9-Play-Hot-10-Play-BL-58BX-6000mAh.htm',
      note:'Référence BL-58BX documentée pour Hot 9 Play et Hot 10 Play.',
      models:[['Infinix','Hot 9 Play'],['Infinix','Hot 10 Play']]
    },
    {
      partReference:'OPPO-A16-A16S-LCD',
      partName:'Afficheur OPPO A16 / A16s',
      partType:'DISPLAY',
      sourceName:'Brico-phone',
      sourceUrl:'https://www.brico-phone.com/22725-ecran-pour-oppo-a16.html',
      note:'Compatibilité explicite A16 CPH2269 et A16s CPH2271. Tester la pièce avant collage.',
      models:[['Oppo','A16'],['Oppo','A16s']]
    },
    {
      partReference:'GH82-A12-M12-A32-5G',
      partName:'Afficheur Samsung A12 / M12 / A32 5G',
      partType:'DISPLAY',
      sourceName:'Pieces2Mobile',
      sourceUrl:'https://www.pieces2mobile.com/ecran-samsung-galaxy-a12-2020-a125f-m12-m127f-a32-5g-a326b-noir-origine.html',
      note:'Références constructeur GH82-24491A / GH82-24490A / GH82-24708A / GH82-24709A. Vérifier le code modèle exact avant montage.',
      models:[['Samsung','Galaxy A12'],['Samsung','Galaxy M12'],['Samsung','Galaxy A32 5G']]
    },
    {
      partReference:'XIAOMI-REDMI9A-9C-10A-LCD',
      partName:'Afficheur Redmi 9A / 9C / 10A',
      partType:'DISPLAY',
      sourceName:'Componenti Digitali',
      sourceUrl:'https://www.componentidigitali.com/fr/componenti-digitali-home-page/pieces-detachees-pour-telephones-et-tablettes/pieces-de-rechange-pour-xiaomi/ecran-lcd-pour-xiaomi/ecran-lcd-pour-xiaomi-redmi-9a-9c-9at-10a-noir-oem-service-pack.3.39.277.gp.37990.uw',
      note:'Service pack OEM listant Redmi 9A, 9C, 9AT et 10A. Tester affichage/tactile avant collage.',
      models:[['Xiaomi','Redmi 9A'],['Xiaomi','Redmi 9C'],['Xiaomi','Redmi 10A']]
    },
    {
      partReference:'5600020K1900-5600060K1900',
      partName:'Afficheur Redmi Note 10 5G / Note 10T 5G / Poco M3 Pro 5G',
      partType:'DISPLAY',
      sourceName:'LCD-Phone',
      sourceUrl:'https://lcd-phone.com/fr/service-pack/62273-ecran-xiaomi-redmi-note-10-5g-note-10t-5g-poco-m3-pro-5g-2021-noir-chassis-service-pack-5600020k1900-5600060k1900-6938700790485.html',
      note:'Service Pack d’origine, références 5600020K1900/5600060K1900. Test fonctionnel recommandé avant collage définitif.',
      models:[['Xiaomi','Redmi Note 10 5G'],['Xiaomi','Redmi Note 10T 5G'],['Xiaomi','Poco M3 Pro 5G']]
    },
    {
      partReference:'02353LKV',
      partName:'Afficheur Huawei Y6p / Honor 9A',
      partType:'DISPLAY',
      sourceName:'APEX Technology',
      sourceUrl:'https://apexgsm.com/models/huawei/y6p-honor-9a/',
      note:'Service Pack partagé Y6p / Honor 9A. Références 02353LKV/02354GMW/02354GMP selon variante.',
      models:[['Huawei','Y6p'],['Honor','9A']]
    },
    {
      partReference:'FPC6605-05',
      partName:'Afficheur Smart 7 / Spark 10 / Spark 10C / Spark Go 2023 / Pop 7',
      partType:'DISPLAY',
      sourceName:'All Spares',
      sourceUrl:'https://all-spares.com/en/lcd-compatible-with-tecno-pop-7-spark-10-spark-go-2023-infinix-smart-7-black-without-frame-original-prc-bf7-bf6-ki5q-ki5k/',
      note:'Famille FPC6605-05. Compatibilité de panneau aftermarket : comparer FPC, connecteur, flex, dimensions et tester avant collage.',
      models:[['Infinix','Smart 7'],['Tecno','Spark 10'],['Tecno','Spark 10C'],['Tecno','Spark Go 2023'],['Tecno','Pop 7'],['Tecno','Pop 7 Pro']]
    }
  ] as const;

  for(const group of compatibilitySeeds){
    for(const [brandName,modelName] of group.models){
      const model=await prisma.deviceModel.findFirst({where:{brand:{name:brandName},name:modelName}});
      if(!model)continue;
      await prisma.partCompatibility.upsert({
        where:{partReference_modelId:{partReference:group.partReference,modelId:model.id}},
        update:{
          partName:group.partName,partType:group.partType,confidence:'VERIFIED',tested:false,
          note:group.note,sourceName:group.sourceName,sourceUrl:group.sourceUrl,sourceCheckedAt:checkedAt
        },
        create:{
          partReference:group.partReference,partName:group.partName,partType:group.partType,modelId:model.id,
          confidence:'VERIFIED',tested:false,note:group.note,sourceName:group.sourceName,sourceUrl:group.sourceUrl,sourceCheckedAt:checkedAt
        }
      });
    }
  }

  // Nettoyage de l'ancien exemple non sourcé si présent.
  await prisma.partCompatibility.deleteMany({where:{partReference:'LCD-SMART5-COMP'}});


  // Fixi Academy starter courses (global, available to every shop).
  const academySeeds = [
    {title:'Diagnostic smartphone — méthode rapide',description:'Une méthode structurée pour éviter de remplacer des pièces au hasard.',category:'Diagnostic',level:AcademyLevel.BEGINNER,lessons:[
      ['1. Recueillir le symptôme','Commencez par reproduire le problème, noter le contexte et vérifier les fonctions de base avant démontage.',8],
      ['2. Isoler la panne','Séparez logiciel, alimentation, charge, écran et carte mère. Testez avec une pièce connue uniquement lorsque cela apporte une preuve.',12],
      ['3. Documenter la solution','Notez la cause réelle, la pièce utilisée et le test final. Une bonne fiche nourrit ensuite Fixi Knowledge.',7],
    ]},
    {title:'Compatibilité afficheurs — bonnes pratiques',description:'Valider une compatibilité sans confondre connecteur identique et compatibilité complète.',category:'Afficheurs',level:AcademyLevel.INTERMEDIATE,lessons:[
      ['Révision matérielle et connecteur','Comparez connecteur, brochage, dimensions, châssis et révision de carte avant de conclure.',10],
      ['Test contrôlé','Testez affichage, tactile, luminosité, proximité et consommation avant de marquer une compatibilité comme vérifiée.',12],
      ['Partager dans Community','Une compatibilité terrain doit rester “proposée” jusqu’à confirmation multi-boutiques ou vérification locale.',6],
    ]},
  ];
  for (const c of academySeeds) {
    let course=await prisma.academyCourse.findFirst({where:{shopId:null,title:c.title}});
    if(!course){course=await prisma.academyCourse.create({data:{shopId:null,title:c.title,description:c.description,category:c.category,level:c.level,published:true}})}
    const count=await prisma.academyLesson.count({where:{courseId:course.id}});
    if(count===0)for(const [title,content,mins] of c.lessons as [string,string,number][])await prisma.academyLesson.create({data:{courseId:course.id,title,content,estimatedMinutes:mins,sortOrder:await prisma.academyLesson.count({where:{courseId:course.id}})}});
  }

  // Migration-safe: generate Client Wallet tokens for clients created before V10.
  const clientsWithoutWallet=await prisma.client.findMany({where:{walletToken:null},select:{id:true}});
  for(const c of clientsWithoutWallet)await prisma.client.update({where:{id:c.id},data:{walletToken:randomUUID().replace(/-/g,'')}});

  // Migration-safe: generate digital warranty cards for previously delivered repairs.
  const delivered=await prisma.repair.findMany({where:{status:RepairStatus.DELIVERED,deliveredAt:{not:null},warrantyDays:{gt:0}},select:{id:true,shopId:true,clientId:true,deliveredAt:true,warrantyDays:true}});
  for(const r of delivered){if(!r.deliveredAt)continue;const exists=await prisma.digitalWarranty.findUnique({where:{repairId:r.id}});if(!exists){const endsAt=new Date(r.deliveredAt.getTime()+r.warrantyDays*86400000);await prisma.digitalWarranty.create({data:{shopId:r.shopId,clientId:r.clientId,repairId:r.id,startsAt:r.deliveredAt,endsAt,coverageText:`Garantie atelier ${r.warrantyDays} jours sur l’intervention réalisée.`}})}}

  console.log('Fixi V10 seed OK');
  console.log(`Boutique initiale : ${initialShopSlug}`);
  console.log(`Administrateur atelier : ${initialAdminLogin}`);
  console.log(`Plateforme SaaS : ${platformLogin}`);
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
