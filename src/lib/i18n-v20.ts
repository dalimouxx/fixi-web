// Traductions arabes des retouches finales : menus réorganisés, journal d'activité lisible,
// libellés des codes (paiements, statuts, actions) et fenêtres de Fixi Control.
export const arV20: Record<string, string> = {
  // Menus
  'Gestion': 'التسيير', 'Mes dettes fournisseurs': 'ديوني للمزودين', 'Achats hors Fixi': 'مشتريات خارج Fixi', 'Demander à un expert': 'اسأل خبيرا',
  'Fournisseurs Fixi': 'مزودو Fixi', 'Catalogue': 'الكتالوج', 'Retour à l’espace fournisseur': 'العودة إلى فضاء المزود', 'Choisir une formule': 'اختر صيغة',
  'Se déconnecter': 'تسجيل الخروج', 'Tableau de bord complet': 'لوحة القيادة كاملة', 'Demander conseil à Fixi': 'اطلب نصيحة من Fixi',
  // Journal d'activité
  'Élément': 'العنصر', 'Détail': 'التفاصيل', 'Utilisateur, action, élément…': 'المستخدم، العملية، العنصر…', 'Sécurité & traçabilité': 'الأمان والتتبع',
  'Connexion': 'تسجيل الدخول', 'Déconnexion': 'تسجيل الخروج', 'Création': 'إنشاء', 'Modification': 'تعديل', 'Suppression': 'حذف', 'Archivage': 'أرشفة',
  'Restauration': 'استرجاع', 'Export': 'تصدير', 'Import': 'استيراد', 'Impression': 'طباعة', 'Pièce ajoutée': 'قطعة مضافة', 'Pièce retirée': 'قطعة مسحوبة',
  'Appareil reçu': 'جهاز مستلم', 'Changement d’étape': 'تغيير المرحلة', 'Accès du support Fixi': 'دخول دعم Fixi', 'Remboursement comptoir': 'استرجاع الكونتوار',
  'Attestation imprimée': 'شهادة مطبوعة', 'Registre exporté': 'السجل مصدَّر', 'Export complet des données': 'تصدير كامل للبيانات',
  'Code de secours créé': 'تم إنشاء رمز الطوارئ', 'Code PIN changé': 'تم تغيير الرمز السري', 'PIN réinitialisé par Fixi': 'أعاد Fixi تعيين الرمز السري',
  'PIN récupéré': 'تم استرجاع الرمز السري', 'Ouverture de caisse': 'فتح الصندوق', 'Clôture de caisse': 'غلق الصندوق', 'Prix modifié': 'تم تعديل السعر',
  'Ajustement de stock': 'تعديل المخزون', 'Utilisateur': 'المستخدم', 'Boutique': 'المحل', 'Réparation': 'إصلاح', 'Paiement': 'دفع', 'Dépense': 'مصروف',
  'Fournisseur': 'المزود', 'Article de stock': 'منتج المخزون', 'Produit': 'منتج', 'Achat': 'شراء', 'Document': 'وثيقة', 'Facture': 'فاتورة', 'Devis': 'عرض سعر',
  'Commande': 'طلبية', 'Données': 'البيانات', 'Garantie': 'الضمان',
  // Moyens de paiement et statuts
  'Carte (TPE)': 'بطاقة (TPE)', 'En ligne': 'عبر الإنترنت', 'Paiement mobile': 'دفع بالهاتف', 'Portefeuille': 'المحفظة', 'À crédit': 'بالدين', 'Mixte': 'مختلط',
  'Paiement à la livraison': 'الدفع عند التسليم', 'Bon cadeau': 'قسيمة هدية', 'Acompte': 'تسبقة', 'Autre': 'آخر',
  'En attente': 'في الانتظار', 'Confirmée': 'مؤكدة', 'Acceptée': 'مقبولة', 'En préparation': 'قيد التحضير', 'Prête': 'جاهزة', 'En livraison': 'قيد التوصيل',
  'En route': 'في الطريق', 'Récupérée': 'تم استلامها', 'Arrivée': 'وصلت', 'Livrée': 'تم التسليم', 'Annulée': 'ملغاة', 'Refusée': 'مرفوضة', 'Échec': 'فشل',
  'Retournée': 'مرجعة', 'Payée': 'مدفوعة', 'Non payée': 'غير مدفوعة', 'Partiellement payée': 'مدفوعة جزئيا', 'En retard': 'متأخرة', 'Brouillon': 'مسودة',
  'Envoyée': 'مرسلة', 'Émise': 'صادرة', 'Convertie': 'محوَّلة', 'Ouverte': 'مفتوحة', 'Clôturée': 'مغلقة', 'Inactive': 'غير نشطة', 'En pause': 'متوقفة',
  'Suspendue': 'معلقة', 'Expirée': 'منتهية', 'Essai': 'تجربة', 'Envoyé': 'مرسل', 'Vérifié': 'تم التحقق', 'Validé': 'مصادق عليه', 'Terminé': 'منتهٍ',
  'En cours': 'جارٍ', 'Réponse envoyée': 'تم إرسال الرد', 'En attente du support': 'في انتظار الدعم', 'Résolu': 'تم الحل', 'Entrée': 'دخول', 'Sortie': 'خروج',
  // Écrans renommés
  'Surveillance de la caisse': 'مراقبة الصندوق', 'Attribution automatique': 'توزيع تلقائي', 'Alerte de stock': 'تنبيه المخزون',
  'Fixi vérifie ces règles automatiquement plusieurs fois par jour.': 'يتحقق Fixi من هذه القواعد تلقائيا عدة مرات في اليوم.',
  'Conseils Fixi': 'نصائح Fixi', 'Contrats d’entretien': 'عقود الصيانة', 'Créer un contrat d’entretien': 'إنشاء عقد صيانة', 'Solutions confirmées': 'حلول مؤكدة',
  'Solutions confirmées par la communauté': 'حلول أكدها المجتمع', 'Aide d’un expert': 'مساعدة خبير', 'Ouvrir la réception hors ligne': 'فتح الاستقبال دون اتصال',
  'Suggestions Fixi': 'اقتراحات Fixi', 'Réception détaillée': 'استقبال مفصل', 'Prix conseillé': 'السعر المقترح', 'Encaissement': 'التحصيل', 'Intégrations': 'الربط',
  'Débutant': 'مبتدئ', 'Intermédiaire': 'متوسط', 'Expert': 'خبير', 'Caisse avancée': 'الصندوق المتقدم',
  // Fixi Control
  'Choisir…': 'اختر…', 'Valider la demande': 'المصادقة على الطلب', 'Refuser la demande': 'رفض الطلب', 'Valider et activer': 'المصادقة والتفعيل', 'Refuser': 'رفض',
};
