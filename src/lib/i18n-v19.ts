// Traductions arabes des écrans Fixi Max 19 : vente comptoir, remboursements, téléphones d'occasion,
// arrivée QR, résumé du jour, commissions, réassort, sécurité et données, factures, code PIN oublié.
export const arV19: Record<string, string> = {
  // Vente comptoir et remboursements
  'Vente comptoir': 'البيع في الكونتوار', 'Réparations': 'الإصلاحات', 'Ticket': 'التذكرة', 'Vider': 'إفراغ', 'Panier vide': 'السلة فارغة',
  'Touchez un article à gauche pour l’ajouter. Le stock est mis à jour à l’encaissement.': 'المس منتجا لإضافته. يتحدث المخزون عند الدفع.',
  'Encaisser la vente': 'تحصيل البيع', 'Vente encaissée': 'تم تحصيل البيع', 'Nouvelle vente': 'بيع جديد', 'Imprimer le ticket': 'طباعة التذكرة',
  'Ventes du jour': 'مبيعات اليوم', 'Ventes du jour et retours': 'مبيعات اليوم والمرتجعات', 'Retour client : numéro du ticket': 'إرجاع زبون: رقم التذكرة', 'Ouvrir': 'فتح',
  'Remise': 'تخفيض', 'Sous-total': 'المجموع الفرعي', 'À payer': 'للدفع', 'Montant reçu': 'المبلغ المستلم', 'Monnaie à rendre': 'الباقي', 'Il manque': 'ينقص',
  'Exact': 'بالضبط', 'Effacer': 'مسح', 'Espèces': 'نقدا', 'Carte': 'بطاقة', 'Virement': 'تحويل', 'Ajouter le client (facultatif)': 'إضافة الزبون (اختياري)',
  'Téléphone client': 'هاتف الزبون', 'Nom': 'الاسم', 'Remboursement effectué': 'تم الاسترجاع', 'Rembourser': 'استرجاع', 'Articles rendus': 'المنتجات المرجعة',
  'Tout rendre': 'إرجاع الكل', 'Remettre en stock': 'إرجاع إلى المخزون', 'Motif': 'السبب', 'Article défectueux': 'منتج معيب', 'Ne convient pas': 'غير مناسب',
  'Erreur de caisse': 'خطأ في الصندوق', 'Autre': 'آخر', 'Rendre l’argent en': 'إرجاع المال عبر', 'Code du gérant': 'رمز المسير', 'Choisissez les articles': 'اختر المنتجات',
  'Choisissez le motif': 'اختر السبب', 'Retour partiel': 'إرجاع جزئي', 'Remboursée': 'مسترجعة', 'Ticket mis à jour': 'تذكرة محدثة', 'Terminer': 'إنهاء',
  'Aucun article trouvé': 'لا يوجد منتج', 'Aucun article à vendre': 'لا يوجد منتج للبيع', 'Ouvrir le stock': 'فتح المخزون', 'Tout': 'الكل',
  // Téléphones d'occasion
  'Téléphones d’occasion': 'الهواتف المستعملة', 'Acheter un téléphone': 'شراء هاتف', 'Registre': 'السجل', 'En stock': 'في المخزون', 'Réservés': 'محجوزة',
  'Vendus': 'مباعة', 'Tous': 'الكل', 'Payé aux vendeurs': 'المدفوع للبائعين', 'Marge du mois': 'هامش الشهر', 'Le téléphone': 'الهاتف', 'Le vendeur': 'البائع',
  'Prix': 'السعر', 'Modèle *': 'الطراز *', 'Stockage': 'سعة التخزين', 'Couleur': 'اللون', 'Santé de la batterie (%)': 'صحة البطارية (%)', 'État': 'الحالة',
  'Accessoires': 'الملحقات', 'Défauts': 'العيوب', 'Nom et prénom *': 'الاسم واللقب *', 'Pièce d’identité': 'بطاقة الهوية', 'Numéro *': 'الرقم *',
  'Délivrée le': 'تاريخ الإصدار', 'Adresse': 'العنوان', 'Prix d’achat (DT) *': 'سعر الشراء (د) *', 'Payé en': 'الدفع عبر', 'Prix de revente (DT)': 'سعر إعادة البيع (د)',
  'Garantie à la revente (jours)': 'الضمان عند البيع (أيام)', 'Enregistrer l’achat': 'تسجيل الشراء', 'Neuf (jamais utilisé)': 'جديد (غير مستعمل)', 'Comme neuf': 'كالجديد',
  'Excellent état': 'حالة ممتازة', 'Très bon état': 'حالة جيدة جدا', 'Bon état': 'حالة جيدة', 'État correct': 'حالة مقبولة', 'Pour pièces': 'للقطع',
  'Vendre ce téléphone': 'بيع هذا الهاتف', 'Réserver pour un client': 'حجز لزبون', 'Remettre en vente': 'إعادة للبيع', 'Étiquette': 'الملصق',
  'Attestation d’achat': 'شهادة الشراء', 'Prix de vente': 'سعر البيع', 'Changer le prix': 'تغيير السعر', 'Téléphone vendu': 'تم بيع الهاتف', 'Ticket avec garantie': 'تذكرة مع الضمان',
  'Réservé': 'محجوز', 'Vendu': 'مباع', 'Prix à fixer': 'السعر لم يحدد', 'Garantie (jours)': 'الضمان (أيام)', 'Paiement': 'الدفع', 'Le client donne': 'الزبون يعطي', 'Marge': 'الهامش',
  // Arrivée QR, résumé, commissions, réassort
  'Résumé du jour': 'ملخص اليوم', 'Encaissé': 'المحصل', 'Reçus aujourd’hui': 'المستلمة اليوم', 'Rendus': 'المسلمة', 'À rendre': 'للتسليم', 'En retard': 'متأخرة',
  'Ventes comptoir': 'مبيعات الكونتوار', 'Caisse': 'الصندوق', 'Envoyer sur WhatsApp': 'إرسال عبر واتساب', 'Commissions des techniciens': 'عمولات التقنيين',
  'Technicien': 'التقني', 'Taux': 'النسبة', 'Commission': 'العمولة', 'Total à verser': 'المجموع للدفع', 'À recommander bientôt': 'يجب طلبه قريبا',
  'Prendre en charge': 'التكفل', 'Affiche QR': 'ملصق QR', 'Gagnez du temps !': 'اربح الوقت!', 'Je m’enregistre': 'أسجّل نفسي', 'Bienvenue 👋': 'مرحبا 👋',
  'Le problème': 'المشكل', 'Marque': 'العلامة', 'Précisions': 'تفاصيل', 'Étiquette garantie': 'ملصق الضمان', 'Commissions': 'العمولات',
  // Sécurité, factures, code PIN oublié
  'Sécurité et données': 'الأمان والبيانات', 'Code de secours du gérant': 'رمز الطوارئ للمسير', 'Créer mon code de secours': 'إنشاء رمز الطوارئ',
  'Créer un nouveau code': 'إنشاء رمز جديد', 'Copie complète de vos données': 'نسخة كاملة من بياناتك', 'Télécharger mes données': 'تحميل بياناتي',
  'Code PIN oublié ?': 'نسيت الرمز السري؟', 'Code PIN oublié': 'الرمز السري منسي', 'Code de secours': 'رمز الطوارئ', 'Nouveau code PIN (6 chiffres)': 'رمز سري جديد (6 أرقام)',
  'Confirmer le code PIN': 'تأكيد الرمز السري', 'Enregistrer mon nouveau code': 'حفظ رمزي الجديد', 'Retour à la connexion': 'العودة لتسجيل الدخول',
  'Total HT': 'المجموع دون أداءات', 'Total TTC': 'المجموع بكل الأداءات', 'Timbre fiscal': 'الطابع الجبائي', 'Désignation': 'البيان', 'Facturation': 'الفوترة',
  'Matricule fiscal': 'المعرف الجبائي', 'Client professionnel (adresse, matricule fiscal)': 'زبون مهني (العنوان، المعرف الجبائي)', 'Code-barres': 'الرمز الشريطي',
  'Oups, cette page a rencontré un problème': 'عذرا، حدث خلل في هذه الصفحة', 'Réessayer': 'إعادة المحاولة', 'Accueil': 'الرئيسية',
  // Export du stock fournisseur et mode support
  'Exporter en Excel': 'تصدير إلى Excel', 'Mode support': 'وضع الدعم', 'Quitter le mode support': 'الخروج من وضع الدعم',
  'Le support Fixi a ouvert votre espace': 'فتح دعم Fixi فضاءكم', 'Accéder': 'دخول', 'Accès support': 'دخول الدعم',
};
