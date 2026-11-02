// Aide contextuelle : une fiche courte par écran, en français et en arabe.
// `video` : lien d'intégration (YouTube « embed » ou fichier .mp4) d'une vidéo
// de 30 s en darija. Laisser vide tant que la vidéo n'est pas tournée.
export type HelpEntry = {
  title: { fr: string; ar: string };
  intro: { fr: string; ar: string };
  steps: { fr: string; ar: string }[];
  tip?: { fr: string; ar: string };
  video?: string;
};

const H = (fr: string, ar: string) => ({ fr, ar });

const entries: Record<string, HelpEntry> = {
  '/app/dashboard': {
    title: H('Accueil', 'الرئيسية'),
    intro: H('Les 4 actions du quotidien, les chiffres du jour et ce qui attend une action.', 'الأعمال الأربعة اليومية، أرقام اليوم وما ينتظر تدخلك.'),
    steps: [
      H('Touchez « Nouvelle réparation » quand un client dépose un appareil.', 'اضغط « إصلاح جديد » عندما يترك الحريف جهازه.'),
      H('« Appareils prêts » liste ce que vous pouvez rendre et encaisser.', '« الأجهزة الجاهزة » تعرض ما يمكن تسليمه وقبض ثمنه.'),
      H('Le bloc « À faire maintenant » vous montre les urgences.', 'قسم « للقيام به الآن » يعرض الأولويات.'),
    ],
    tip: H('Besoin de plus de modules ? Passez en « Avancé » en bas du menu.', 'تحتاج وحدات أكثر؟ اختر « متقدم » أسفل القائمة.'),
  },
  '/app/repairs/new': {
    title: H('Nouvelle réparation', 'إصلاح جديد'),
    intro: H('Enregistrez un appareil en moins d’une minute.', 'سجّل جهازاً في أقل من دقيقة.'),
    steps: [
      H('Tapez le téléphone du client : s’il est connu, son nom se remplit tout seul.', 'اكتب هاتف الحريف: إذا كان معروفاً يُملأ اسمه تلقائياً.'),
      H('Choisissez la marque puis le modèle.', 'اختر العلامة ثم الطراز.'),
      H('Touchez la panne (écran, batterie…) ou décrivez-la.', 'اختر العطب (شاشة، بطارية…) أو صِفه.'),
      H('Indiquez le prix annoncé puis enregistrez : le ticket est prêt à imprimer.', 'أدخل السعر المتفق عليه ثم سجّل: الوصل جاهز للطباعة.'),
    ],
    tip: H('Le micro permet de dicter la panne en français ou en arabe.', 'يمكنك إملاء العطب بالفرنسية أو العربية عبر الميكروفون.'),
  },
  '/app/repairs': {
    title: H('Réparations', 'الإصلاحات'),
    intro: H('Tous les appareils, rangés par étape.', 'كل الأجهزة مرتبة حسب المرحلة.'),
    steps: [
      H('Chaque couleur = une étape : gris reçu, bleu en réparation, jaune attente pièce, vert prêt.', 'كل لون = مرحلة: رمادي مستلم، أزرق قيد الإصلاح، أصفر بانتظار قطعة، أخضر جاهز.'),
      H('Ouvrez une fiche puis utilisez le gros bouton orange pour passer à l’étape suivante.', 'افتح البطاقة ثم استعمل الزر البرتقالي للانتقال إلى المرحلة التالية.'),
    ],
  },
  '/app/repairs/[code]': {
    title: H('Fiche réparation', 'بطاقة الإصلاح'),
    intro: H('Tout se fait depuis le bouton « Étape suivante ».', 'كل شيء يتم من زر « المرحلة التالية ».'),
    steps: [
      H('Le bouton orange propose la prochaine action logique.', 'الزر البرتقالي يقترح الخطوة المنطقية التالية.'),
      H('Les boutons WhatsApp envoient un message prêt au client en un clic.', 'أزرار واتساب ترسل رسالة جاهزة للحريف بنقرة واحدة.'),
      H('En attente de pièce ? « Commander chez mon fournisseur » ouvre la commande.', 'بانتظار قطعة؟ « اطلب من مزوّدي » يفتح الطلب.'),
    ],
  },
  '/app/clients': {
    title: H('Clients', 'العملاء'),
    intro: H('Retrouvez un client par son nom ou son téléphone.', 'ابحث عن حريف بالاسم أو الهاتف.'),
    steps: [H('Ouvrez la fiche pour voir son historique et ce qu’il doit.', 'افتح البطاقة لرؤية تاريخه وما عليه.')],
  },
  '/app/cashier': {
    title: H('Encaisser', 'القبض'),
    intro: H('Encaissez un appareil prêt et remettez-le au client.', 'اقبض ثمن جهاز جاهز وسلّمه للحريف.'),
    steps: [
      H('Choisissez l’appareil dans la liste ou tapez son code.', 'اختر الجهاز من القائمة أو اكتب رمزه.'),
      H('Choisissez le mode de paiement, vérifiez le montant.', 'اختر طريقة الدفع وتحقق من المبلغ.'),
      H('Validez : le ticket est imprimé et l’appareil passe en « Livré ».', 'أكّد: يُطبع الوصل ويصبح الجهاز « مُسلّم ».'),
    ],
  },
  '/app/documents': {
    title: H('Devis & factures', 'عروض الأسعار والفواتير'),
    intro: H('Créez un devis, envoyez-le, puis transformez-le en facture.', 'أنشئ عرض سعر، أرسله، ثم حوّله إلى فاتورة.'),
    steps: [H('Le statut indique ce qui est payé et ce qui reste.', 'تبيّن الحالة ما تم دفعه وما تبقى.')],
  },
  '/app/payments': {
    title: H('Paiements reçus', 'المدفوعات'),
    intro: H('Tous les encaissements de la boutique, par jour et par mode.', 'كل المقبوضات حسب اليوم وطريقة الدفع.'),
    steps: [H('Utilisez les filtres de date pour un jour précis.', 'استعمل فلاتر التاريخ ليوم محدد.')],
  },
  '/app/cash-sessions': {
    title: H('Ouverture & clôture', 'فتح وغلق الصندوق'),
    intro: H('Ouvrez la caisse le matin, fermez-la le soir.', 'افتح الصندوق صباحاً وأغلقه مساءً.'),
    steps: [H('À la clôture, comptez l’argent : Fixi calcule l’écart.', 'عند الغلق عدّ المال: يحسب Fixi الفارق.')],
  },
  '/app/expenses': {
    title: H('Dépenses', 'المصاريف'),
    intro: H('Notez chaque dépense pour connaître votre vrai bénéfice.', 'سجّل كل مصروف لمعرفة ربحك الحقيقي.'),
    steps: [H('Loyer, électricité, pièces achetées en ville…', 'الكراء، الكهرباء، قطع مشتراة…')],
  },
  '/app/stock': {
    title: H('Mon stock', 'مخزوني'),
    intro: H('Vos pièces disponibles et celles à racheter.', 'قطعك المتوفرة وتلك التي يجب شراؤها.'),
    steps: [H('Une pièce utilisée dans une réparation est retirée du stock automatiquement.', 'القطعة المستعملة في إصلاح تُخصم آلياً من المخزون.')],
  },
  '/app/suppliers': {
    title: H('Commander une pièce', 'اطلب قطعة'),
    intro: H('Commandez chez vos fournisseurs Fixi et suivez la livraison.', 'اطلب من مزوّديك على Fixi وتابع التوصيل.'),
    steps: [
      H('Cherchez la pièce, ajoutez-la au panier, validez.', 'ابحث عن القطعة، أضفها للسلة، ثم أكّد.'),
      H('Suivez la commande dans l’onglet « Mes commandes ».', 'تابع الطلب في « طلباتي ».'),
    ],
  },
  '/app/mes-dettes': {
    title: H('Ce que je dois', 'ما عليّ'),
    intro: H('Le détail de ce que vous devez à chaque fournisseur.', 'تفاصيل ما تدين به لكل مزوّد.'),
    steps: [H('Chaque ligne montre la facture, les paiements et le reste.', 'كل سطر يبيّن الفاتورة والمدفوعات والباقي.')],
  },
  '/app/compatibility': {
    title: H('Pièce compatible ?', 'هل القطعة متوافقة؟'),
    intro: H('Vérifiez si une pièce va sur un autre modèle.', 'تحقق إن كانت قطعة تصلح لطراز آخر.'),
    steps: [H('Tapez le modèle : Fixi liste les pièces confirmées par d’autres réparateurs.', 'اكتب الطراز: يعرض Fixi القطع المؤكدة من مصلحين آخرين.')],
  },
  '/app/warranties': {
    title: H('Garanties & retours', 'الضمان والإرجاع'),
    intro: H('Un client revient avec un problème ? Ouvrez un dossier ici.', 'عاد حريف بمشكل؟ افتح ملفاً هنا.'),
    steps: [H('Fixi vérifie automatiquement si la garantie est encore valable.', 'يتحقق Fixi آلياً من صلاحية الضمان.')],
  },
  '/app/fin-de-journee': {
    title: H('Fin de journée', 'نهاية اليوم'),
    intro: H('Le résumé de la journée, à envoyer au gérant sur WhatsApp.', 'ملخص اليوم لإرساله للمسؤول عبر واتساب.'),
    steps: [
      H('Vérifiez l’encaissé et les dépenses.', 'تحقق من المقبوض والمصاريف.'),
      H('Touchez « Envoyer sur WhatsApp ».', 'اضغط « إرسال عبر واتساب ».'),
    ],
  },
  '/app/team': {
    title: H('Équipe', 'الفريق'),
    intro: H('Ajoutez vos employés et choisissez leur rôle.', 'أضف موظفيك واختر دورهم.'),
    steps: [H('Chaque rôle voit uniquement ce dont il a besoin.', 'كل دور يرى فقط ما يحتاجه.')],
  },
  '/app/settings': {
    title: H('Paramètres', 'الإعدادات'),
    intro: H('Nom, logo, téléphone WhatsApp, imprimante et messages.', 'الاسم، الشعار، هاتف واتساب، الطابعة والرسائل.'),
    steps: [H('Les données de démonstration se suppriment en un clic en bas de page.', 'تُحذف بيانات التجربة بنقرة أسفل الصفحة.')],
  },
};

const fallback: HelpEntry = {
  title: H('Aide', 'مساعدة'),
  intro: H('Une question sur cet écran ? Notre équipe répond rapidement.', 'سؤال حول هذه الشاشة؟ فريقنا يجيب بسرعة.'),
  steps: [
    H('Écrivez au support depuis « Aide & support ».', 'راسل الدعم من « مساعدة ودعم ».'),
    H('Passez en Mode Avancé pour voir tous les modules.', 'اختر الوضع المتقدم لرؤية كل الوحدات.'),
  ],
};

export function helpFor(pathname: string): HelpEntry {
  if (entries[pathname]) return entries[pathname];
  if (/^\/app\/repairs\/(?!new)[^/]+$/.test(pathname)) return entries['/app/repairs/[code]'];
  const prefix = Object.keys(entries).filter(k => pathname.startsWith(k + '/')).sort((a, b) => b.length - a.length)[0];
  return prefix ? entries[prefix] : fallback;
}
