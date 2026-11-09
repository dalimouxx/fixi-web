import {useEffect} from 'react';

// Traduction arabe de l'interface : on traduit les textes affichés (et placeholder/title/aria-label)
// sans toucher au code des écrans. Les tickets et étiquettes imprimés restent en français.
const AR:Record<string,string>={
 'Lignes SL / MG':'الخطوط SL / MG', 'Chaque partie seule : ventes, dû des clients, stock, inventaire.':'كل جزء على حدة: المبيعات، ديون الحرفاء، المخزون، الجرد.', 'Lignes de produits':'خطوط المنتجات', 'Ligne':'الخط', 'Pièces vendues':'القطع المباعة', 'Dû des clients':'ديون الحرفاء', 'Valeur du stock':'قيمة المخزون', 'À payer':'المستحق', 'Tout':'الكل', 'Bénéfice (barème)':'الربح (حسب السلّم)', 'Jour':'اليوم', 'Client qui doit':'الحريف المدين', 'Dû':'المستحق', 'Aucune vente sur la période.':'لا مبيعات خلال الفترة.', 'Aucun client ne doit rien.':'لا يوجد حريف مدين.', 'Inventaire de cette ligne':'جرد هذا الخط', 'Prix':'السعر', 'Coût':'الكلفة', 'Valeur':'القيمة', 'Ligne à compter':'الخط المراد جرده', 'Tout le stock':'كل المخزون', 'Toutes les lignes':'كل الخطوط', 'Imprimer':'طباعة',
 'Client de passage : ajouter un supplément au prix atelier (non visible sur le ticket)':'زبون عابر: إضافة زيادة على سعر الورشة (لا تظهر في التذكرة)',
 'Passager':'زبون عابر', 'Ligne de produits':'خط المنتجات', 'Mes produits':'منتجاتي',
 'Caisse':'الصندوق','Vente':'البيع','Clients':'الحرفاء','Livraison':'التوصيل','Articles':'السلع','Menu':'القائمة',
 'Tickets & ventes':'التذاكر والمبيعات','Retours & avoirs':'المرتجعات والأرصدة','Session de caisse':'جلسة الصندوق','Dettes clients':'ديون الحرفاء',
 'Commandes en ligne':'الطلبات عبر الإنترنت','Recettes livreurs':'مداخيل الموزعين','Catalogue':'الكتالوج','Stock':'المخزون',
 'Retrouver une vente et réimprimer son ticket.':'ابحث عن عملية بيع وأعد طباعة تذكرتها.','Scannez le ticket du client, puis choisissez les articles rendus.':'امسح تذكرة الحريف ثم اختر السلع المرجعة.',
 'Ouvrez la caisse le matin, clôturez-la le soir.':'افتح الصندوق صباحًا وأغلقه مساءً.','Créez un client et vendez-lui directement.':'أضف حريفًا وبِع له مباشرة.',
 'Ce que chaque client doit encore, et ses versements.':'ما تبقّى على كل حريف ودفعاته.','Confirmez, préparez, puis passez au livreur.':'أكّد، حضّر، ثم سلّم للموزّع.',
 'Comptez l’argent rapporté par chaque livreur.':'احسب المال الذي جلبه كل موزّع.','Prix détail et gros de chaque article.':'سعر التفصيل والجملة لكل سلعة.','Les ruptures d’abord.':'النافد أولاً.',
 'Synchroniser':'مزامنة','Étiquettes':'الملصقات','Verrouiller':'قفل','Activer':'تفعيل','Réglages':'الإعدادات','Changer de caissier':'تغيير الصرّاف','Fermer FIXI Caisse':'إغلاق FIXI Caisse','Fermer':'إغلاق',
 'Agrandir le menu':'توسيع القائمة','Réduire le menu':'تصغير القائمة','Recharger produits, prix et stock':'إعادة تحميل السلع والأسعار والمخزون','Verrouiller la caisse (code PIN)':'قفل الصندوق (الرمز السري)',
 'PIN 4 chiffres':'رمز من 4 أرقام','Nouveau code PIN':'رمز سري جديد','Hors ligne':'دون اتصال','À envoyer':'للإرسال','Ventes hors ligne':'مبيعات دون اتصال',
 'Scannez ou tapez une référence (F2)':'امسح أو اكتب المرجع (F2)','Ajouter':'إضافة','Chercher un produit…':'ابحث عن سلعة…','Effacer':'مسح','Tout effacer':'مسح الكل',
 'Détail':'تفصيل','Gros':'جملة','Tarif':'التعريفة','Tarif appliqué au panier':'التعريفة المطبّقة على السلة','Videz le panier pour changer de tarif':'أفرغ السلة لتغيير التعريفة',
 'Tous':'الكل','Autres':'أخرى','Les plus vendus':'الأكثر مبيعًا','Rupture':'نفد','Aucun produit':'لا توجد سلع','Essayez un autre mot ou une autre catégorie.':'جرّب كلمة أو فئة أخرى.',
 'Panier':'السلة','Panier vide':'السلة فارغة','Scannez un article ou touchez un produit.':'امسح سلعة أو المس منتجًا.','Vider le panier':'إفراغ السلة',
 'Article libre':'سلعة حرّة','Nouvelle pièce':'قطعة جديدة','Code de vérification':'رمز التحقق','Réception':'الاستقبال','À rendre · Encaisser':'للتسليم · القبض','Fin de journée':'نهاية اليوم','Connexion atelier':'دخول الورشة','Ouvrir le comptoir':'فتح الشباك','Je suis fournisseur':'أنا مزود','Je suis un atelier de réparation':'أنا ورشة إصلاح','Enregistrer et imprimer le ticket':'سجّل واطبع الوصل','Téléphone client':'هاتف الحريف','Panne':'العطب','Modèle':'الموديل','Prix estimé (DT)':'السعر التقديري (د.ت)','Urgent':'عاجل','Rien à rendre':'لا شيء للتسليم','Choisissez un appareil':'اختر جهازاً','À encaisser':'للقبض','Encaissé aujourd’hui':'المقبوض اليوم','Par moyen de paiement':'حسب طريقة الدفع','Derniers encaissements':'آخر المقابيض','Créer la pièce':'إنشاء القطعة','Création…':'جارٍ الإنشاء…','Prix de vente (DT)':'سعر البيع (د.ت)','Coût d’achat (DT, facultatif)':'سعر الشراء (د.ت، اختياري)','Ajouter 1 au panier après création':'أضف 1 إلى السلة بعد الإنشاء','Code-barres':'الباركود','Reconnu sur le réseau Fixi : nom pré-rempli.':'معروف في شبكة Fixi: تمّ ملء الاسم.','La pièce est ajoutée à votre catalogue FIXI. SKU, catégorie et marque sont remplis automatiquement.':'تُضاف القطعة إلى كتالوج FIXI. الرمز والصنف والماركة تُملأ تلقائياً.','Remise':'تخفيض','En attente':'في الانتظار','Paniers en attente':'سلال في الانتظار','Client':'الحريف','Vente comptoir':'بيع على الكونتوار','Nouveau client':'حريف جديد',
 'Espèces':'نقدًا','Carte':'بطاقة','Virement':'تحويل','Moyen de paiement':'طريقة الدفع','Total':'المجموع','tarif détail':'سعر التفصيل','tarif gros':'سعر الجملة',
 'Payé maintenant':'المدفوع الآن','Le client donne':'الحريف يعطي','Espèces reçues':'النقود المستلمة','Monnaie à rendre':'الباقي للحريف','Il manque':'ينقص','En trop':'زائد',
 'Réimprimer':'إعادة الطباعة','WhatsApp':'واتساب','Tiroir':'الدرج','Enregistrement…':'جارٍ التسجيل…','l’unité':'للوحدة',
 'Vente à vérifier':'بيع للتحقق','Vérifier la vente':'تحقق من البيع','Renvoyer':'إعادة الإرسال','Vérifier':'تحقق','Vérifier dans FIXI':'تحقق في FIXI',
 'Produit':'السلعة','Référence':'المرجع','Catégorie':'الفئة','Prix détail':'سعر التفصيل','Prix gros':'سعر الجملة','Disponible':'متوفر','État':'الحالة','Stock faible':'مخزون ضعيف','En rupture':'نافد',
 'Chercher par nom ou référence':'ابحث بالاسم أو المرجع','Nouveau client ':'حريف جديد','Nom ou société *':'الاسم أو الشركة *','Nom du client':'اسم الحريف','Téléphone':'الهاتف','Adresse':'العنوان','Facultatif':'اختياري',
 'Aucun client':'لا يوجد حرفاء','Ajoutez votre premier client ci-dessus.':'أضف أول حريف أعلاه.','Vendre':'بيع',
 'Mise à jour automatique toutes les 20 secondes.':'تحديث تلقائي كل 20 ثانية.','Actualiser':'تحديث','Aucune commande en attente':'لا توجد طلبات في الانتظار','Les commandes des ateliers arrivent ici.':'طلبات الورشات تصل هنا.',
 'Confirmer':'تأكيد','Commencer la préparation':'بدء التحضير','Prête pour le livreur':'جاهزة للموزّع','En attente du livreur':'في انتظار الموزّع',
 'Nouvelle':'جديدة','Confirmée':'مؤكدة','En préparation':'قيد التحضير','Prête':'جاهزة','En livraison':'قيد التوصيل','Livrée':'تم التسليم','Annulée':'ملغاة','Retournée':'مرجعة',
 'Payée':'مدفوعة','Partielle':'جزئية','Non payée':'غير مدفوعة','Terminée':'منتهية','Remboursé':'مُسترجع','Émis':'صادر','Ouverte':'مفتوحة','Clôturée':'مغلقة','À clôturer':'للإغلاق','Déclarée':'مُصرّح بها','Refusée':'مرفوضة',
 'Versement à vérifier':'دفعة للتحقق','Renvoyer le même paiement':'إعادة نفس الدفعة','Total dû par les clients':'مجموع ديون الحرفاء','Clients avec dette':'حرفاء مدينون',
 'Encaisser un versement':'استلام دفعة','La somme règle d’abord les factures les plus anciennes.':'المبلغ يسدّد الفواتير الأقدم أولاً.','Choisir le client':'اختر الحريف','Montant (DT)':'المبلغ (د.ت)','Encaisser':'استلام',
 'Aucune dette':'لا ديون','Tous les clients sont à jour.':'كل الحرفاء خالصون.','Factures':'الفواتير','Dette':'الدين','Recevoir':'استلام',
 'Retrouver la vente':'ابحث عن البيع','Rechercher un ticket':'ابحث عن تذكرة','Code du ticket, nom, téléphone ou référence':'رمز التذكرة أو الاسم أو الهاتف أو المرجع','Scannez le ticket ou tapez, puis Entrée':'امسح التذكرة أو اكتب ثم Entrée',
 'Du':'من','Au':'إلى','Rechercher':'بحث','Ticket':'التذكرة','Faire un retour':'إرجاع','Avoir à vérifier':'رصيد للتحقق','Renvoyer le même retour':'إعادة نفس الإرجاع',
 'Retour et avoir':'إرجاع ورصيد','Vente d’origine':'البيع الأصلي','Choisir la vente':'اختر البيع','État du produit':'حالة السلعة','Bon état':'حالة جيدة','Endommagé':'تالف','Motif':'السبب','Remboursement (DT)':'المبلغ المسترجع (د.ت)',
 'Confirmer le retour':'تأكيد الإرجاع','Seuls le propriétaire, l’administrateur ou le responsable peuvent enregistrer un retour.':'فقط المالك أو المدير أو المسؤول يمكنه تسجيل إرجاع.',
 'Avoirs précédents':'الأرصدة السابقة','Aucun avoir':'لا أرصدة','Les retours enregistrés apparaîtront ici.':'المرتجعات المسجلة ستظهر هنا.','Avoir':'الرصيد','Montant':'المبلغ',
 'Dernières ventes':'آخر المبيعات','Aucune vente':'لا مبيعات','Les ventes de la caisse apparaîtront ici.':'مبيعات الصندوق ستظهر هنا.','Date':'التاريخ','Payé':'المدفوع',
 'Caisse ouverte':'الصندوق مفتوح','Caisse fermée':'الصندوق مغلق','Ouvrez la caisse avant d’encaisser des espèces.':'افتح الصندوق قبل استلام النقود.',
 'Fond de caisse':'رصيد البداية','Ventes de la session':'مبيعات الجلسة','Encaissé (tous moyens)':'المستلم (كل الطرق)','Espèces attendues':'النقود المنتظرة',
 'Clôturer : compter la caisse':'الإغلاق: عدّ الصندوق','Tapez le nombre de billets et de pièces. FIXI fait le total et compare avec l’attendu.':'اكتب عدد الأوراق والقطع. FIXI يحسب المجموع ويقارنه بالمنتظر.',
 'Billets':'الأوراق','Pièces':'القطع','Compté':'المعدود','Attendu dans la caisse':'المنتظر في الصندوق','Caisse juste':'الصندوق مضبوط','Explication de l’écart':'سبب الفارق','Explication de l’écart *':'سبب الفارق *',
 'Ex. monnaie rendue en trop, dépense non saisie…':'مثال: باقٍ زائد، مصروف غير مسجّل…','Clôturer et imprimer le rapport':'أغلق واطبع التقرير','Imprimer le rapport Z':'اطبع تقرير Z',
 'Rapport X : point de la journée sans clôturer.':'تقرير X: حصيلة اليوم دون إغلاق.','Rapport Z de la dernière clôture.':'تقرير Z لآخر إغلاق.','Ouvrir la caisse':'فتح الصندوق','Fond de caisse (DT)':'رصيد البداية (د.ت)','Observation':'ملاحظة','Ouvrir':'فتح',
 'Dernières sessions':'آخر الجلسات','Aucune session':'لا جلسات','Les ouvertures et clôtures apparaîtront ici.':'عمليات الفتح والإغلاق ستظهر هنا.','Ouverture':'الفتح','Clôture':'الإغلاق',
 'Aucune recette en attente':'لا مداخيل في الانتظار','Quand un livreur termine sa tournée, sa remise apparaît ici.':'عندما ينهي الموزّع جولته تظهر مداخيله هنا.','Attendu':'المنتظر','Montant reçu (DT)':'المبلغ المستلم (د.ت)',
 'Obligatoire si le montant est différent':'إجباري إذا كان المبلغ مختلفًا','Clôturer la recette':'إغلاق المدخول','Remises livreurs':'مداخيل الموزعين','Aucune remise':'لا مداخيل','L’historique des remises apparaîtra ici.':'سجل المداخيل سيظهر هنا.','Livreur':'الموزّع','Déclaré':'المصرّح به',
 'Caisse verrouillée':'الصندوق مقفل','Déverrouiller':'فتح القفل','Code PIN':'الرمز السري','Moins':'أقل','Plus':'أكثر',
 'Bonjour 👋':'مرحبًا 👋','Qui ouvre la caisse ?':'من يفتح الصندوق؟','Ouvrir la caisse de':'فتح صندوق','Ouverture…':'جارٍ الفتح…','Ajouter un caissier':'إضافة صرّاف','Mot de passe':'كلمة السر',
 'Connexion':'تسجيل الدخول','Avec votre compte FIXI Supplier.':'بحسابك في FIXI Supplier.','Avec son propre compte FIXI Supplier (créé par le gérant dans Équipe).':'بحسابه الخاص في FIXI Supplier (يُنشئه المدير في الفريق).',
 'Identifiant':'المعرّف','Serveur':'الخادم','Adresse du serveur FIXI':'عنوان خادم FIXI','Se connecter':'دخول','Connexion…':'جارٍ الدخول…','Revenir au code PIN':'العودة إلى الرمز السري','Essayer sans connexion (démonstration)':'تجربة دون اتصال (عرض)',
 'Le point de vente Windows de FIXI Supplier.':'نقطة بيع Windows لـ FIXI Supplier.','Scanner rapide, panier gardé même après coupure':'مسح سريع، والسلة محفوظة حتى بعد الانقطاع','Ventes, dettes clients et retours au même endroit':'المبيعات والديون والمرتجعات في مكان واحد','Tickets et étiquettes code-barres':'تذاكر وملصقات بالرمز الشريطي',
 'Pour une pièce sans code-barres ou un service. Le stock n’est pas touché.':'لقطعة دون رمز شريطي أو خدمة. المخزون لا يتغيّر.','Nom':'الاسم','Prix unitaire (DT)':'سعر الوحدة (د.ت)','Quantité':'الكمية','Ex. Pose écran, câble USB…':'مثال: تركيب شاشة، كابل USB…',
 'Main-d’œuvre':'اليد العاملة','Accessoire':'إكسسوار','Service':'خدمة','Réparation':'تصليح','Divers':'متنوع',
 'Sur tout le panier':'على كامل السلة','En %':'بالنسبة %','En DT':'بالدينار','Pourcentage':'النسبة','Prix d’une ligne':'سعر سطر','Retirer les remises':'إزالة التخفيضات','Appliquer':'تطبيق',
 'Réglages de la caisse':'إعدادات الصندوق','Langue':'اللغة','Apparence':'المظهر','Clair':'فاتح','Sombre':'داكن','Auto':'تلقائي','Tiroir-caisse':'درج النقود',
 'Le tiroir branché sur l’imprimante de tickets s’ouvre à chaque encaissement en espèces.':'الدرج الموصول بطابعة التذاكر يُفتح عند كل استلام نقدي.','Imprimante du tiroir':'طابعة الدرج','Aucun tiroir':'لا يوجد درج',
 'Ouvrir automatiquement après une vente en espèces':'فتح تلقائي بعد بيع نقدي','Tester l’ouverture':'تجربة الفتح','Écran client':'شاشة الحريف','Sur un 2ᵉ moniteur tourné vers le client : articles, total et monnaie rendue.':'على شاشة ثانية مقابلة للحريف: السلع والمجموع والباقي.',
 'Afficher':'إظهار','Masquer':'إخفاء','Mises à jour':'التحديثات','Vérifier maintenant':'تحقق الآن','Caissier':'الصرّاف','Retirer ce caissier du PC':'إزالة هذا الصرّاف من الحاسوب',
 'Retire le caissier connecté de ce PC (son code PIN est effacé, son compte FIXI reste intact).':'يزيل الصرّاف المتصل من هذا الحاسوب (يُمحى رمزه السري ويبقى حسابه في FIXI).',
 'Tout est envoyé':'تم إرسال الكل','Aucune vente en attente.':'لا مبيعات في الانتظار.','Envoyer maintenant':'أرسل الآن','Ces ventes attendent d’être envoyées à FIXI.':'هذه المبيعات في انتظار الإرسال إلى FIXI.',
 'Pas de connexion à FIXI. Les ventes sont gardées sur ce PC et partent toutes seules dès que la connexion revient.':'لا اتصال بـ FIXI. المبيعات محفوظة على هذا الحاسوب وتُرسل تلقائيًا عند عودة الاتصال.',
 'Mettre à jour':'تحديث','Téléchargement…':'جارٍ التنزيل…','Plus tard':'لاحقًا','Nouvelles fonctions et corrections.':'ميزات وإصلاحات جديدة.',
 'Panier vidé.':'تم إفراغ السلة.','Panier mis en attente. Servez le client suivant.':'وُضعت السلة في الانتظار. اخدم الحريف التالي.','Caisse clôturée.':'تم إغلاق الصندوق.','FIXI Caisse est à jour.':'FIXI Caisse محدّث.',
 'Catalogue synchronisé. Panier conservé.':'تمت مزامنة الكتالوج. السلة محفوظة.','Pas de connexion : vente gardée sur ce PC, envoi automatique au retour d’Internet.':'لا اتصال: البيع محفوظ على الحاسوب ويُرسل تلقائيًا عند عودة الإنترنت.',
 'Activez un code PIN (en haut) pour ouvrir la caisse en 2 secondes la prochaine fois.':'فعّل رمزًا سريًا (في الأعلى) لفتح الصندوق في ثانيتين المرة القادمة.','Code PIN protégé dans Windows.':'الرمز السري محمي في Windows.',
 'Montant payé incorrect.':'المبلغ المدفوع غير صحيح.','Sélectionnez un client pour une vente à crédit.':'اختر حريفًا للبيع بالدين.','Numéro WhatsApp invalide.':'رقم واتساب غير صالح.','Tiroir ouvert.':'الدرج مفتوح.',
 'Étiquettes Code 128':'ملصقات Code 128','Nom fournisseur':'اسم المزوّد','Format':'المقاس','Rechercher les produits...':'ابحث عن السلع...','Imprimer les étiquettes':'اطبع الملصقات','Choisissez des étiquettes.':'اختر الملصقات.',
 'Bienvenue':'مرحبًا بكم','en rupture':'نافد','stock(s) faible(s)':'مخزون ضعيف','article':'سلعة','articles':'سلع','Client 1':'حريف 1',
 'Ticket imprimé ou dialogue fermé : vérifiez la sortie papier, réimprimez si nécessaire.':'طُبعت التذكرة أو أُغلقت النافذة: تحقّق من الورقة وأعد الطباعة إن لزم.','Vérifiez que le ticket est bien sorti de l’imprimante. Sinon utilisez Réimprimer.':'تحقق من خروج التذكرة من الطابعة، وإلا أعد الطباعة.',
 'Ventes':'المبيعات','Chiffre d’affaires':'رقم المعاملات','Encaissé':'المستلم','À crédit':'بالدين','Remises':'التخفيضات','Entrées':'المداخيل','Sorties':'المصاريف','Écart':'الفارق','Écran client ouvert sur le 2ᵉ écran.':'شاشة الحريف مفتوحة على الشاشة الثانية.','Un seul écran détecté : l’écran client s’ouvre dans une fenêtre.':'شاشة واحدة فقط: تُفتح شاشة الحريف في نافذة.','Vos articles s’afficheront ici.':'ستظهر سلعكم هنا.','À bientôt !':'إلى اللقاء!','Merci !':'شكرًا!','Monnaie rendue':'الباقي','Reçu':'المستلم',
 '— choisissez un client':'— اختر حريفًا','(crédit client)':'(دين على الحريف)','Remis en stock':'يُعاد إلى المخزون','Mis de côté, hors stock':'يوضع جانبًا خارج المخزون',
};
const PATTERNS:[RegExp,(m:RegExpMatchArray)=>string][]=[
 [/^Supplément passager pour (.+)$/,m=>`زيادة الزبون العابر لـ ${m[1]}`],
 [/^(\d+) articles?$/,m=>`${m[1]} سلعة`],
 [/^Encaisser (.+)$/,m=>`استلام ${m[1]}`],
 [/^Ajouter (.+ DT\u2069?)$/,m=>`إضافة ${m[1]}`],
 [/^Sous-total (.+)$/,m=>`المجموع الفرعي ${m[1]}`],
 [/^Après prix modifiés (.+)$/,m=>`بعد تعديل الأسعار ${m[1]}`],
 [/^Nouveau total (.+)$/,m=>`المجموع الجديد ${m[1]}`],
 [/^Reste dû (.*)$/,m=>`الباقي ${tr(m[1])}`],
 [/^Depuis le (.+)$/,m=>`منذ ${m[1]}`],
 [/^Déclaré (.+)$/,m=>`المصرّح به ${m[1]}`],
 [/^(\d+) en rupture$/,m=>`${m[1]} نافد`],
 [/^· (\d+) stock\(s\) faible\(s\)$/,m=>`· ${m[1]} مخزون ضعيف`],
 [/^(\d+) tickets? trouvés?$/,m=>`${m[1]} تذكرة`],
 [/^Recette de (.+)$/,m=>`مدخول ${m[1]}`],
 [/^Écart : (.+)$/,m=>`الفارق: ${m[1]}`],
 [/^Version installée :$/,()=>'النسخة المثبتة:'],
 [/^Article libre · (.+) l’unité$/,m=>`سلعة حرّة · ${m[1]} للوحدة`],
 [/^(.+ DT\u2069?) l’unité$/,m=>`${m[1]} للوحدة`],
 [/^Gros (.+ DT\u2069?)$/,m=>`جملة ${m[1]}`],
 [/^Détail (.+ DT\u2069?)$/,m=>`تفصيل ${m[1]}`],
 [/^Vente enregistrée : (.+)$/,m=>`تم تسجيل البيع: ${m[1]}`],
 [/^(.+) ajouté au panier$/,m=>`${m[1]} أضيف إلى السلة`],
 [/^Client (\d+)$/,m=>`حريف ${m[1]}`],
 [/^· (\d+) stock\(s\) faible\(s\)$/,m=>`· ${m[1]} مخزون ضعيف`],
 [/^(\d+) produit\(s\), (\d+) étiquette\(s\)$/,m=>`${m[1]} سلعة، ${m[2]} ملصق`],
 [/^(\d+) vente\(s\) hors ligne envoyée\(s\) à FIXI\.$/,m=>`${m[1]} بيع دون اتصال أُرسل إلى FIXI.`],
 [/^FIXI Caisse (.+) est disponible\.$/,m=>`FIXI Caisse ${m[1]} متوفر.`],
 [/^Code-barres introuvable : (.+)$/,m=>`رمز شريطي غير موجود: ${m[1]}`],
 [/^Stock insuffisant pour (.+)$/,m=>`مخزون غير كافٍ لـ ${m[1]}`],
 [/^(.+) · code PIN$/,m=>`${m[1]} · الرمز السري`],
];
function tr(t:string):string{
 const k=t.trim();if(!k)return t;
 if(AR[k])return t.replace(k,AR[k]);
 for(const [re,f] of PATTERNS){const m=k.match(re);if(m)return t.replace(k,f(m))}
 const role=k.match(/^(Propriétaire|Administrateur|Responsable|Vendeur|Caissier|Démonstration)( · .+)?$/);
 if(role){const r:Record<string,string>={Propriétaire:'المالك',Administrateur:'المدير',Responsable:'المسؤول',Vendeur:'البائع',Caissier:'الصرّاف','Démonstration':'عرض'};return t.replace(k,r[role[1]]+(role[2]||''))}
 return t;
}
const ATTRS=['placeholder','title','aria-label'];
const originals=new WeakMap<Node,string>();
const attrOriginals=new WeakMap<Element,Record<string,string>>();
const skip=(n:Node|null)=>{for(let e=n instanceof Element?n:n?.parentElement;e;e=e.parentElement){if(e.classList?.contains('v4-receipt')||e.classList?.contains('labels-print-area')||e.tagName==='SCRIPT'||e.tagName==='STYLE'||e.hasAttribute?.('data-no-tr'))return true}return false};
let applying=false;
function translateNode(root:Node){
 const walk=document.createTreeWalker(root,NodeFilter.SHOW_TEXT|NodeFilter.SHOW_ELEMENT);
 let n:Node|null=root;
 while(n){
  if(n.nodeType===Node.TEXT_NODE&&!skip(n)){
   const cur=n.nodeValue||'';const orig=originals.get(n);
   if(!(orig!==undefined&&tr(orig)===cur)){const out=tr(cur);if(out!==cur){originals.set(n,cur);n.nodeValue=out}}
  }else if(n instanceof Element&&!skip(n)){
   for(const a of ATTRS){const v=n.getAttribute(a);if(!v)continue;const out=tr(v);if(out!==v){const o=attrOriginals.get(n)||{};if(!(a in o))o[a]=v;attrOriginals.set(n,o);n.setAttribute(a,out)}}
  }
  n=walk.nextNode();
 }
}
function restore(root:Node){
 const walk=document.createTreeWalker(root,NodeFilter.SHOW_TEXT|NodeFilter.SHOW_ELEMENT);let n:Node|null=walk.nextNode();
 while(n){if(n.nodeType===Node.TEXT_NODE){const o=originals.get(n);if(o!==undefined){n.nodeValue=o;originals.delete(n)}}else if(n instanceof Element){const o=attrOriginals.get(n);if(o){for(const [a,v] of Object.entries(o))n.setAttribute(a,v);attrOriginals.delete(n)}}n=walk.nextNode()}
}
export function useArabic(on:boolean){
 useEffect(()=>{
  const html=document.documentElement;
  html.lang=on?'ar':'fr';html.dir=on?'rtl':'ltr';
  if(!on){restore(document.body);return}
  applying=true;translateNode(document.body);applying=false;
  const obs=new MutationObserver(list=>{if(applying)return;applying=true;
   for(const m of list){if(m.type==='characterData'){originals.delete(m.target);translateNode(m.target)}else if(m.type==='attributes'&&m.target instanceof Element){const o=attrOriginals.get(m.target);if(o&&m.attributeName)delete o[m.attributeName];translateNode(m.target)}else m.addedNodes.forEach(x=>translateNode(x))}
   obs.takeRecords();applying=false});
  obs.observe(document.body,{subtree:true,childList:true,characterData:true,attributes:true,attributeFilter:ATTRS});
  return()=>{obs.disconnect()};
 },[on]);
}
