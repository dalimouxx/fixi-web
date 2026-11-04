/** Centre d'aide Fixi (18.3) : guides par rôle et FAQ, en français et en arabe. Contenu factuel des fonctions existantes. */
export type HelpRole = 'atelier' | 'fournisseur' | 'livreur';
type L = { fr: string; ar: string };
export type Guide = { role: HelpRole; title: L; intro: L; steps: { t: L; d: L }[] };

export const GUIDES: Guide[] = [
  { role: 'atelier', title: { fr: 'Atelier de réparation', ar: 'ورشة الإصلاح' }, intro: { fr: 'De l’inscription à votre première réparation encaissée.', ar: 'من التسجيل إلى أول إصلاح مقبوض.' }, steps: [
    { t: { fr: 'Créez votre compte', ar: 'أنشئ حسابك' }, d: { fr: 'Sur fixi : « Commencer » → nom de la boutique, gouvernorat, votre nom, téléphone et un code PIN à 6 chiffres. L’offre gratuite Fixi Connect est activée tout de suite.', ar: 'على Fixi: «ابدأ» ← اسم المحل، الولاية، اسمك، الهاتف ورمز سري من 6 أرقام. يتم تفعيل العرض المجاني Fixi Connect فوراً.' } },
    { t: { fr: 'Commandez vos pièces', ar: 'اطلب قطعك' }, d: { fr: 'Fournisseurs → cherchez la pièce, « Ajouter », puis « Commander ». Pièce introuvable ? Onglet « Demandes » : les fournisseurs vous répondent avec leur prix.', ar: 'المزودون ← ابحث عن القطعة، «أضف» ثم «اطلب». قطعة غير موجودة؟ تبويب «الطلبات»: يجيبك المزودون بأسعارهم.' } },
    { t: { fr: 'Recevez la livraison', ar: 'استلم التوصيل' }, d: { fr: 'Vous êtes prévenu quand le livreur arrive. Donnez-lui le code affiché dans « Mes commandes » : c’est la preuve de remise.', ar: 'يتم إعلامك عند وصول الموزع. أعطه الرمز الظاهر في «طلبياتي»: هو إثبات التسليم.' } },
    { t: { fr: 'Passez à Fixi Pro', ar: 'انتقل إلى Fixi Pro' }, d: { fr: 'Réparations, stock, caisse et équipe : « Essayer Fixi Pro » une fois, sans paiement. À la fin de l’essai, retour automatique à l’offre gratuite, rien n’est effacé.', ar: 'الإصلاحات والمخزون والصندوق والفريق: «جرّب Fixi Pro» مرة واحدة بدون دفع. عند نهاية التجربة تعود تلقائياً للعرض المجاني ولا يُحذف شيء.' } },
    { t: { fr: 'Enregistrez une réparation', ar: 'سجّل إصلاحاً' }, d: { fr: '« Nouvelle réparation » : téléphone du client, appareil, panne, prix. Imprimez le reçu et l’étiquette ; le client suit sa réparation en ligne.', ar: '«إصلاح جديد»: هاتف الحريف، الجهاز، العطب، السعر. اطبع الوصل والملصق؛ يتابع الحريف إصلاحه على الإنترنت.' } },
    { t: { fr: 'Encaissez et rendez', ar: 'اقبض وسلّم' }, d: { fr: 'Caisse → choisissez l’appareil prêt, le moyen de paiement, encaissez. Sur PC, la caisse Windows (mode atelier) imprime le ticket et ouvre le tiroir.', ar: 'الصندوق ← اختر الجهاز الجاهز وطريقة الدفع ثم اقبض. على الحاسوب، صندوق ويندوز (وضع الورشة) يطبع الوصل ويفتح الدرج.' } },
  ] },
  { role: 'fournisseur', title: { fr: 'Fournisseur de pièces', ar: 'مزود القطع' }, intro: { fr: 'Catalogue, commandes des ateliers, livraisons et argent.', ar: 'الكتالوج وطلبيات الورشات والتوصيل والأموال.' }, steps: [
    { t: { fr: 'Ajoutez vos produits', ar: 'أضف منتجاتك' }, d: { fr: 'Produits → « Rapide » : nom, prix, stock. Le SKU, la catégorie et la marque sont ajoutés seuls. Beaucoup de produits ? « En série » (coller depuis Excel) ou « Excel ».', ar: 'المنتجات ← «سريع»: الاسم، السعر، المخزون. الرمز والصنف والماركة تُضاف تلقائياً. منتجات كثيرة؟ «بالجملة» (لصق من إكسل) أو «إكسل».' } },
    { t: { fr: 'Traitez les commandes', ar: 'عالج الطلبيات' }, d: { fr: 'Confirmez, préparez au scanner (la mauvaise pièce est refusée), puis « Prête à livrer » et affectez un livreur.', ar: 'أكّد، حضّر بالماسح (القطعة الخاطئة مرفوضة)، ثم «جاهزة للتوصيل» وعيّن موزعاً.' } },
    { t: { fr: 'Vendez plus', ar: 'بع أكثر' }, d: { fr: 'Lancez une promo sur un produit (prix barré chez les ateliers), répondez aux demandes de pièces, relancez les clients qui décrochent.', ar: 'أطلق تخفيضاً على منتج (سعر مشطوب عند الورشات)، أجب على طلبات القطع، وذكّر الحرفاء الذين ابتعدوا.' } },
    { t: { fr: 'Encaissez', ar: 'اقبض أموالك' }, d: { fr: '« Qui me doit » : clients en retard, relance en un clic ou automatique (J+7, J+15, J+30), plafond de crédit appliqué aux commandes.', ar: '«من يدين لي»: الحرفاء المتأخرون، تذكير بنقرة أو تلقائي (7، 15، 30 يوماً)، وسقف القرض مطبق على الطلبيات.' } },
    { t: { fr: 'Vendez au comptoir', ar: 'بع في الشباك' }, d: { fr: 'Installez FIXI Caisse sur Windows : scanner, ticket, tiroir, écran client. Le gérant crée une nouvelle pièce directement en caisse.', ar: 'ثبّت FIXI Caisse على ويندوز: ماسح، وصل، درج، شاشة الحريف. يُنشئ المسير قطعة جديدة مباشرة من الصندوق.' } },
    { t: { fr: 'Protégez votre compte', ar: 'احمِ حسابك' }, d: { fr: 'Équipe → « Double vérification » avec Google Authenticator, et « Tout déconnecter » si un téléphone est perdu.', ar: 'الفريق ← «التحقق المزدوج» مع Google Authenticator، و«قطع الكل» إذا ضاع هاتف.' } },
  ] },
  { role: 'livreur', title: { fr: 'Livreur', ar: 'الموزع' }, intro: { fr: 'Votre journée de livraison, étape par étape.', ar: 'يوم التوصيل خطوة بخطوة.' }, steps: [
    { t: { fr: 'Ouvrez votre journée', ar: 'افتح يومك' }, d: { fr: 'Connectez-vous avec l’identifiant donné par votre fournisseur, puis « Ouvrir la journée ».', ar: 'ادخل بالمعرّف الذي أعطاك إياه المزود، ثم «فتح اليوم».' } },
    { t: { fr: 'Démarrez la tournée', ar: 'ابدأ الجولة' }, d: { fr: 'L’ordre des arrêts est optimisé. L’atelier est prévenu automatiquement quand vous arrivez à quelques minutes.', ar: 'ترتيب المحطات محسّن. يتم إعلام الورشة تلقائياً عندما تقترب بدقائق.' } },
    { t: { fr: 'Remettez avec preuve', ar: 'سلّم بإثبات' }, d: { fr: 'Demandez le code à l’atelier, faites signer au doigt, ajoutez une photo si besoin, puis glissez pour confirmer.', ar: 'اطلب الرمز من الورشة، اطلب الإمضاء بالإصبع، أضف صورة إن لزم، ثم اسحب للتأكيد.' } },
    { t: { fr: 'Atelier fermé ou absent ?', ar: 'الورشة مغلقة أو غائب؟' }, d: { fr: '« Plus » → « Atelier fermé » ou « Client absent », photo de la devanture : une nouvelle tentative est programmée (3 passages maximum).', ar: '«المزيد» ← «الورشة مغلقة» أو «الحريف غائب»، صورة للواجهة: تُبرمج محاولة جديدة (3 مرات كحد أقصى).' } },
    { t: { fr: 'Reprises et encaissements', ar: 'الاسترجاع والقبض' }, d: { fr: 'Les pièces à reprendre s’affichent dans « À reprendre ». Encaissez à la livraison si demandé (pas d’encaissement sur une course partenaire).', ar: 'القطع للاسترجاع تظهر في «للاسترجاع». اقبض عند التسليم إن طُلب (لا قبض في رحلة شريك).' } },
  ] },
];

export const FAQ: { q: L; a: L }[] = [
  { q: { fr: 'Fixi est-il vraiment gratuit ?', ar: 'هل Fixi مجاني فعلاً؟' }, a: { fr: 'Oui pour les ateliers : catalogue fournisseurs, commandes, livraisons, factures et dettes restent gratuits sans limite de durée. Les réparations, le stock et la caisse sont dans Fixi Pro.', ar: 'نعم للورشات: كتالوج المزودين والطلبيات والتوصيل والفواتير والديون مجانية بلا حد زمني. الإصلاحات والمخزون والصندوق في Fixi Pro.' } },
  { q: { fr: 'Que se passe-t-il à la fin de l’essai Pro ?', ar: 'ماذا يحدث عند نهاية تجربة Pro؟' }, a: { fr: 'Votre atelier revient à l’offre gratuite automatiquement. Aucune donnée n’est supprimée et aucun paiement n’est demandé.', ar: 'تعود ورشتك تلقائياً للعرض المجاني. لا تُحذف أي بيانات ولا يُطلب أي دفع.' } },
  { q: { fr: 'J’ai oublié mon code PIN.', ar: 'نسيت رمزي السري.' }, a: { fr: 'Le gérant peut le réinitialiser dans Équipe. Si vous êtes le gérant, contactez le support Fixi depuis la page de connexion.', ar: 'يمكن للمسير إعادة تعيينه في الفريق. إذا كنت المسير، اتصل بدعم Fixi من صفحة الدخول.' } },
  { q: { fr: 'Fixi marche-t-il en arabe et sans Internet ?', ar: 'هل يعمل Fixi بالعربية وبدون إنترنت؟' }, a: { fr: 'Oui en arabe (bouton AR). La caisse Windows garde les ventes en cas de coupure et les envoie au retour d’Internet.', ar: 'نعم بالعربية (زر AR). صندوق ويندوز يحفظ المبيعات عند الانقطاع ويرسلها عند عودة الإنترنت.' } },
  { q: { fr: 'Mes données sont-elles protégées ?', ar: 'هل بياناتي محمية؟' }, a: { fr: 'Chaque atelier ou fournisseur ne voit que ses données. Codes protégés, connexions chiffrées, double vérification possible. Voir la politique de confidentialité.', ar: 'كل ورشة أو مزود يرى بياناته فقط. رموز محمية، اتصالات مشفرة، وتحقق مزدوج ممكن. راجع سياسة الخصوصية.' } },
  { q: { fr: 'Comment ajouter mon fournisseur habituel ?', ar: 'كيف أضيف مزودي المعتاد؟' }, a: { fr: 'Fournisseurs → « Inviter mon fournisseur » : il reçoit un lien pour créer son espace.', ar: 'المزودون ← «ادعُ مزودي»: يستلم رابطاً لإنشاء فضائه.' } },
];

export function pitch(app = 'Fixi', url = 'https://fixi-web.onrender.com/inscription') {
  return {
    fr: `Bonjour 👋 Je vous présente ${app}, l’application des ateliers de réparation en Tunisie : commandez vos pièces chez les fournisseurs, suivez la livraison, gérez vos dettes — gratuitement. Réparations, stock et caisse avec ${app} Pro (essai gratuit). Inscription en 2 minutes : ${url}`,
    ar: `مرحباً 👋 أقدّم لك ${app}، تطبيق ورشات الإصلاح في تونس: اطلب قطعك من المزودين، تابع التوصيل، وتصرّف في ديونك — مجاناً. الإصلاحات والمخزون والصندوق مع ${app} Pro (تجربة مجانية). التسجيل في دقيقتين: ${url}`,
  };
}
