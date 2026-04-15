import { createContext, useContext, useState, useCallback, type ReactNode } from "react";

export const LANGUAGES = [
  { code: "en", name: "English", flag: "\u{1F1EC}\u{1F1E7}" },
  { code: "es", name: "Espa\u00f1ol", flag: "\u{1F1EA}\u{1F1F8}" },
  { code: "fr", name: "Fran\u00e7ais", flag: "\u{1F1EB}\u{1F1F7}" },
  { code: "de", name: "Deutsch", flag: "\u{1F1E9}\u{1F1EA}" },
  { code: "pt", name: "Portugu\u00eas", flag: "\u{1F1E7}\u{1F1F7}" },
  { code: "ar", name: "\u0627\u0644\u0639\u0631\u0628\u064A\u0629", flag: "\u{1F1F8}\u{1F1E6}" },
  { code: "zh", name: "\u4E2D\u6587", flag: "\u{1F1E8}\u{1F1F3}" },
  { code: "ja", name: "\u65E5\u672C\u8A9E", flag: "\u{1F1EF}\u{1F1F5}" },
] as const;

export type LangCode = (typeof LANGUAGES)[number]["code"];

const translations: Record<string, Record<LangCode, string>> = {
  "nav.dashboard": { en: "Dashboard", es: "Panel", fr: "Tableau de bord", de: "Dashboard", pt: "Painel", ar: "\u0644\u0648\u062D\u0629 \u0627\u0644\u0642\u064A\u0627\u062F\u0629", zh: "\u4EEA\u8868\u677F", ja: "\u30C0\u30C3\u30B7\u30E5\u30DC\u30FC\u30C9" },
  "nav.contracts": { en: "Contracts", es: "Contratos", fr: "Contrats", de: "Vertr\u00e4ge", pt: "Contratos", ar: "\u0627\u0644\u0639\u0642\u0648\u062F", zh: "\u5408\u540C", ja: "\u5951\u7D04" },
  "nav.upload": { en: "Upload", es: "Subir", fr: "T\u00e9l\u00e9charger", de: "Hochladen", pt: "Enviar", ar: "\u0631\u0641\u0639", zh: "\u4E0A\u4F20", ja: "\u30A2\u30C3\u30D7\u30ED\u30FC\u30C9" },
  "nav.pricing": { en: "Pricing", es: "Precios", fr: "Tarifs", de: "Preise", pt: "Pre\u00e7os", ar: "\u0627\u0644\u0623\u0633\u0639\u0627\u0631", zh: "\u4EF7\u683C", ja: "\u6599\u91D1" },
  "nav.settings": { en: "Settings", es: "Ajustes", fr: "Param\u00e8tres", de: "Einstellungen", pt: "Configura\u00e7\u00f5es", ar: "\u0627\u0644\u0625\u0639\u062F\u0627\u062F\u0627\u062A", zh: "\u8BBE\u7F6E", ja: "\u8A2D\u5B9A" },
  "nav.logout": { en: "Logout", es: "Cerrar sesi\u00f3n", fr: "D\u00e9connexion", de: "Abmelden", pt: "Sair", ar: "\u062A\u0633\u062C\u064A\u0644 \u0627\u0644\u062E\u0631\u0648\u062C", zh: "\u9000\u51FA", ja: "\u30ED\u30B0\u30A2\u30A6\u30C8" },
  "nav.login": { en: "Login", es: "Iniciar sesi\u00f3n", fr: "Connexion", de: "Anmelden", pt: "Entrar", ar: "\u062A\u0633\u062C\u064A\u0644 \u0627\u0644\u062F\u062E\u0648\u0644", zh: "\u767B\u5F55", ja: "\u30ED\u30B0\u30A4\u30F3" },
  "landing.hero.badge": { en: "AI-Powered Legal Analysis", es: "An\u00e1lisis Legal con IA", fr: "Analyse Juridique par IA", de: "KI-gest\u00fctzte Rechtsanalyse", pt: "An\u00e1lise Jur\u00eddica com IA", ar: "\u062A\u062D\u0644\u064A\u0644 \u0642\u0627\u0646\u0648\u0646\u064A \u0628\u0627\u0644\u0630\u0643\u0627\u0621 \u0627\u0644\u0627\u0635\u0637\u0646\u0627\u0639\u064A", zh: "AI\u9A71\u52A8\u7684\u6CD5\u5F8B\u5206\u6790", ja: "AI\u642D\u8F09\u6CD5\u7684\u5206\u6790" },
  "landing.hero.title1": { en: "Understand any contract", es: "Comprende cualquier contrato", fr: "Comprenez tout contrat", de: "Verstehen Sie jeden Vertrag", pt: "Entenda qualquer contrato", ar: "\u0627\u0641\u0647\u0645 \u0623\u064A \u0639\u0642\u062F", zh: "\u7406\u89E3\u4EFB\u4F55\u5408\u540C", ja: "\u3042\u3089\u3086\u308B\u5951\u7D04\u3092\u7406\u89E3" },
  "landing.hero.title2": { en: " in seconds.", es: " en segundos.", fr: " en secondes.", de: " in Sekunden.", pt: " em segundos.", ar: " \u0641\u064A \u062B\u0648\u0627\u0646\u064D.", zh: "\u53EA\u9700\u51E0\u79D2\u3002", ja: "\u6570\u79D2\u3067\u3002" },
  "landing.hero.desc": { en: "Your contract analyzer in your pocket \u2014 without paying expensive lawyers. Upload a PDF and get an instant plain-English summary, risk analysis, and key clause extraction.", es: "Tu analizador de contratos de bolsillo \u2014 sin pagar abogados caros. Sube un PDF y obt\u00e9n un resumen instant\u00e1neo, an\u00e1lisis de riesgos y extracci\u00f3n de cl\u00e1usulas clave.", fr: "Votre analyseur de contrats de poche \u2014 sans payer cher un avocat. T\u00e9l\u00e9chargez un PDF et obtenez un r\u00e9sum\u00e9 instantan\u00e9, une analyse des risques et une extraction des clauses cl\u00e9s.", de: "Ihr Vertragsanalysator f\u00fcr die Hosentasche \u2014 ohne teure Anw\u00e4lte. Laden Sie ein PDF hoch und erhalten Sie sofort eine Zusammenfassung, Risikoanalyse und Schl\u00fcsselklausel-Extraktion.", pt: "Seu analisador de contratos no bolso \u2014 sem pagar advogados caros. Envie um PDF e obtenha um resumo instant\u00e2neo, an\u00e1lise de riscos e extra\u00e7\u00e3o de cl\u00e1usulas-chave.", ar: "\u0645\u062D\u0644\u0644 \u0627\u0644\u0639\u0642\u0648\u062F \u0641\u064A \u062C\u064A\u0628\u0643 \u2014 \u0628\u062F\u0648\u0646 \u062F\u0641\u0639 \u0623\u062A\u0639\u0627\u0628 \u0645\u062D\u0627\u0645\u064A\u0646 \u0628\u0627\u0647\u0638\u0629. \u0627\u0631\u0641\u0639 \u0645\u0644\u0641 PDF \u0648\u0627\u062D\u0635\u0644 \u0639\u0644\u0649 \u0645\u0644\u062E\u0635 \u0641\u0648\u0631\u064A \u0648\u062A\u062D\u0644\u064A\u0644 \u0627\u0644\u0645\u062E\u0627\u0637\u0631 \u0648\u0627\u0633\u062A\u062E\u0631\u0627\u062C \u0627\u0644\u0628\u0646\u0648\u062F \u0627\u0644\u0631\u0626\u064A\u0633\u064A\u0629.", zh: "\u968F\u8EAB\u643A\u5E26\u7684\u5408\u540C\u5206\u6790\u5668\u2014\u2014\u65E0\u9700\u652F\u4ED8\u6602\u8D35\u7684\u5F8B\u5E08\u8D39\u7528\u3002\u4E0A\u4F20PDF\u5373\u53EF\u83B7\u5F97\u5373\u65F6\u6458\u8981\u3001\u98CE\u9669\u5206\u6790\u548C\u5173\u952E\u6761\u6B3E\u63D0\u53D6\u3002", ja: "\u30DD\u30B1\u30C3\u30C8\u306B\u5165\u308B\u5951\u7D04\u30A2\u30CA\u30E9\u30A4\u30B6\u30FC\u2014\u2014\u9AD8\u984D\u306A\u5F01\u8B77\u58EB\u8CBB\u7528\u306F\u4E0D\u8981\u3002PDF\u3092\u30A2\u30C3\u30D7\u30ED\u30FC\u30C9\u3057\u3066\u3001\u5373\u5EA7\u306B\u8981\u7D04\u3001\u30EA\u30B9\u30AF\u5206\u6790\u3001\u91CD\u8981\u6761\u9805\u306E\u62BD\u51FA\u3092\u53D6\u5F97\u3002" },
  "landing.hero.cta": { en: "Analyze your first contract free", es: "Analiza tu primer contrato gratis", fr: "Analysez votre premier contrat gratuitement", de: "Analysieren Sie Ihren ersten Vertrag kostenlos", pt: "Analise seu primeiro contrato gr\u00e1tis", ar: "\u062D\u0644\u0644 \u0639\u0642\u062F\u0643 \u0627\u0644\u0623\u0648\u0644 \u0645\u062C\u0627\u0646\u0627\u064B", zh: "\u514D\u8D39\u5206\u6790\u60A8\u7684\u7B2C\u4E00\u4EFD\u5408\u540C", ja: "\u6700\u521D\u306E\u5951\u7D04\u3092\u7121\u6599\u3067\u5206\u6790" },
  "landing.hero.plans": { en: "View plans", es: "Ver planes", fr: "Voir les plans", de: "Pl\u00e4ne ansehen", pt: "Ver planos", ar: "\u0639\u0631\u0636 \u0627\u0644\u062E\u0637\u0637", zh: "\u67E5\u770B\u8BA1\u5212", ja: "\u30D7\u30E9\u30F3\u3092\u898B\u308B" },
  "landing.hero.free": { en: "No credit card required. Free plan includes 3 contracts.", es: "No se requiere tarjeta de cr\u00e9dito. El plan gratuito incluye 3 contratos.", fr: "Pas de carte de cr\u00e9dit requise. Le plan gratuit inclut 3 contrats.", de: "Keine Kreditkarte erforderlich. Der kostenlose Plan umfasst 3 Vertr\u00e4ge.", pt: "Sem cart\u00e3o de cr\u00e9dito. O plano gratuito inclui 3 contratos.", ar: "\u0644\u0627 \u062D\u0627\u062C\u0629 \u0644\u0628\u0637\u0627\u0642\u0629 \u0627\u0626\u062A\u0645\u0627\u0646. \u0627\u0644\u062E\u0637\u0629 \u0627\u0644\u0645\u062C\u0627\u0646\u064A\u0629 \u062A\u0634\u0645\u0644 3 \u0639\u0642\u0648\u062F.", zh: "\u65E0\u9700\u4FE1\u7528\u5361\u3002\u514D\u8D39\u8BA1\u5212\u5305\u542B3\u4EFD\u5408\u540C\u3002", ja: "\u30AF\u30EC\u30B8\u30C3\u30C8\u30AB\u30FC\u30C9\u4E0D\u8981\u3002\u7121\u6599\u30D7\u30E9\u30F3\u306F3\u4EF6\u306E\u5951\u7D04\u3092\u542B\u307F\u307E\u3059\u3002" },
  "landing.features.title": { en: "Everything you need to review contracts confidently", es: "Todo lo que necesitas para revisar contratos con confianza", fr: "Tout ce dont vous avez besoin pour examiner des contrats en toute confiance", de: "Alles, was Sie brauchen, um Vertr\u00e4ge sicher zu pr\u00fcfen", pt: "Tudo o que voc\u00ea precisa para revisar contratos com confian\u00e7a", ar: "\u0643\u0644 \u0645\u0627 \u062A\u062D\u062A\u0627\u062C\u0647 \u0644\u0645\u0631\u0627\u062C\u0639\u0629 \u0627\u0644\u0639\u0642\u0648\u062F \u0628\u062B\u0642\u0629", zh: "\u81EA\u4FE1\u5BA1\u67E5\u5408\u540C\u6240\u9700\u7684\u4E00\u5207", ja: "\u5951\u7D04\u3092\u81EA\u4FE1\u3092\u6301\u3063\u3066\u78BA\u8A8D\u3059\u308B\u305F\u3081\u306B\u5FC5\u8981\u306A\u3059\u3079\u3066" },
  "landing.cta.title": { en: "Ready to stop guessing?", es: "\u00bfListo para dejar de adivinar?", fr: "Pr\u00eat \u00e0 arr\u00eater de deviner ?", de: "Bereit, aufzuh\u00f6ren zu raten?", pt: "Pronto para parar de adivinhar?", ar: "\u0647\u0644 \u0623\u0646\u062A \u0645\u0633\u062A\u0639\u062F \u0644\u0644\u062A\u0648\u0642\u0641 \u0639\u0646 \u0627\u0644\u062A\u062E\u0645\u064A\u0646\u061F", zh: "\u51C6\u5907\u597D\u505C\u6B62\u731C\u6D4B\u4E86\u5417\uFF1F", ja: "\u63A8\u6E2C\u3092\u3084\u3081\u308B\u6E96\u5099\u306F\u3067\u304D\u307E\u3057\u305F\u304B\uFF1F" },
  "landing.cta.desc": { en: "Start analyzing contracts today. It's free to get started.", es: "Comienza a analizar contratos hoy. Es gratis para empezar.", fr: "Commencez \u00e0 analyser des contrats d\u00e8s aujourd'hui. C'est gratuit pour commencer.", de: "Beginnen Sie noch heute mit der Vertragsanalyse. Der Einstieg ist kostenlos.", pt: "Comece a analisar contratos hoje. \u00c9 gr\u00e1tis para come\u00e7ar.", ar: "\u0627\u0628\u062F\u0623 \u0628\u062A\u062D\u0644\u064A\u0644 \u0627\u0644\u0639\u0642\u0648\u062F \u0627\u0644\u064A\u0648\u0645. \u0627\u0644\u0628\u062F\u0627\u064A\u0629 \u0645\u062C\u0627\u0646\u064A\u0629.", zh: "\u4ECA\u5929\u5C31\u5F00\u59CB\u5206\u6790\u5408\u540C\u3002\u514D\u8D39\u5F00\u59CB\u3002", ja: "\u4ECA\u65E5\u304B\u3089\u5951\u7D04\u5206\u6790\u3092\u59CB\u3081\u307E\u3057\u3087\u3046\u3002\u7121\u6599\u3067\u59CB\u3081\u3089\u308C\u307E\u3059\u3002" },
  "landing.cta.button": { en: "Start for free", es: "Empieza gratis", fr: "Commencer gratuitement", de: "Kostenlos starten", pt: "Comece gr\u00e1tis", ar: "\u0627\u0628\u062F\u0623 \u0645\u062C\u0627\u0646\u0627\u064B", zh: "\u514D\u8D39\u5F00\u59CB", ja: "\u7121\u6599\u3067\u59CB\u3081\u308B" },
  "landing.trusted": { en: "Trusted by thousands", es: "Confiado por miles", fr: "La confiance de milliers", de: "Von Tausenden vertraut", pt: "Confiado por milhares", ar: "\u0645\u0648\u062B\u0648\u0642 \u0628\u0647 \u0645\u0646 \u0627\u0644\u0622\u0644\u0627\u0641", zh: "\u4E07\u5343\u7528\u6237\u4FE1\u8D56", ja: "\u6570\u5343\u4EBA\u304C\u4FE1\u983C" },
  "dashboard.title": { en: "Dashboard", es: "Panel de control", fr: "Tableau de bord", de: "Dashboard", pt: "Painel", ar: "\u0644\u0648\u062D\u0629 \u0627\u0644\u0642\u064A\u0627\u062F\u0629", zh: "\u4EEA\u8868\u677F", ja: "\u30C0\u30C3\u30B7\u30E5\u30DC\u30FC\u30C9" },
  "dashboard.upload": { en: "Upload contract", es: "Subir contrato", fr: "T\u00e9l\u00e9charger un contrat", de: "Vertrag hochladen", pt: "Enviar contrato", ar: "\u0631\u0641\u0639 \u0639\u0642\u062F", zh: "\u4E0A\u4F20\u5408\u540C", ja: "\u5951\u7D04\u3092\u30A2\u30C3\u30D7\u30ED\u30FC\u30C9" },
  "settings.title": { en: "Settings", es: "Ajustes", fr: "Param\u00e8tres", de: "Einstellungen", pt: "Configura\u00e7\u00f5es", ar: "\u0627\u0644\u0625\u0639\u062F\u0627\u062F\u0627\u062A", zh: "\u8BBE\u7F6E", ja: "\u8A2D\u5B9A" },
  "settings.account": { en: "Account", es: "Cuenta", fr: "Compte", de: "Konto", pt: "Conta", ar: "\u0627\u0644\u062D\u0633\u0627\u0628", zh: "\u8D26\u6237", ja: "\u30A2\u30AB\u30A6\u30F3\u30C8" },
  "settings.plan": { en: "Plan", es: "Plan", fr: "Plan", de: "Plan", pt: "Plano", ar: "\u0627\u0644\u062E\u0637\u0629", zh: "\u8BA1\u5212", ja: "\u30D7\u30E9\u30F3" },
  "settings.language": { en: "Language", es: "Idioma", fr: "Langue", de: "Sprache", pt: "Idioma", ar: "\u0627\u0644\u0644\u063A\u0629", zh: "\u8BED\u8A00", ja: "\u8A00\u8AAE" },
  "settings.theme": { en: "Appearance", es: "Apariencia", fr: "Apparence", de: "Erscheinungsbild", pt: "Apar\u00eancia", ar: "\u0627\u0644\u0645\u0638\u0647\u0631", zh: "\u5916\u89C2", ja: "\u5916\u89B3" },
  "settings.referral": { en: "Referral Program", es: "Programa de referidos", fr: "Programme de parrainage", de: "Empfehlungsprogramm", pt: "Programa de indica\u00e7\u00e3o", ar: "\u0628\u0631\u0646\u0627\u0645\u062C \u0627\u0644\u0625\u062D\u0627\u0644\u0629", zh: "\u63A8\u8350\u8BA1\u5212", ja: "\u7D39\u4ECB\u30D7\u30ED\u30B0\u30E9\u30E0" },
  "common.getStarted": { en: "Get started", es: "Comenzar", fr: "Commencer", de: "Loslegen", pt: "Come\u00e7ar", ar: "\u0627\u0628\u062F\u0623 \u0627\u0644\u0622\u0646", zh: "\u5F00\u59CB", ja: "\u59CB\u3081\u308B" },
  "common.upgrade": { en: "Upgrade plan", es: "Mejorar plan", fr: "Am\u00e9liorer le plan", de: "Plan upgraden", pt: "Atualizar plano", ar: "\u062A\u0631\u0642\u064A\u0629 \u0627\u0644\u062E\u0637\u0629", zh: "\u5347\u7EA7\u8BA1\u5212", ja: "\u30D7\u30E9\u30F3\u3092\u30A2\u30C3\u30D7\u30B0\u30EC\u30FC\u30C9" },
  "splash.trusted": { en: "Trusted by 10,000+ professionals worldwide", es: "Confiado por m\u00e1s de 10,000 profesionales en todo el mundo", fr: "Approuv\u00e9 par plus de 10 000 professionnels dans le monde", de: "Von \u00fcber 10.000 Fachleuten weltweit vertraut", pt: "Confiado por mais de 10.000 profissionais no mundo todo", ar: "\u0645\u0648\u062B\u0648\u0642 \u0628\u0647 \u0645\u0646 \u0623\u0643\u062B\u0631 \u0645\u0646 10,000 \u0645\u062D\u062A\u0631\u0641 \u062D\u0648\u0644 \u0627\u0644\u0639\u0627\u0644\u0645", zh: "\u53D7\u5168\u740310,000+\u4E13\u4E1A\u4EBA\u58EB\u4FE1\u8D56", ja: "\u4E16\u754C\u4E2D10,000\u4EBA\u4EE5\u4E0A\u306E\u5C02\u9580\u5BB6\u304C\u4FE1\u983C" },
  "language.select": { en: "Select your language", es: "Selecciona tu idioma", fr: "Choisissez votre langue", de: "W\u00e4hlen Sie Ihre Sprache", pt: "Selecione seu idioma", ar: "\u0627\u062E\u062A\u0631 \u0644\u063A\u062A\u0643", zh: "\u9009\u62E9\u60A8\u7684\u8BED\u8A00", ja: "\u8A00\u8AAE\u3092\u9078\u629E" },
  "language.continue": { en: "Continue", es: "Continuar", fr: "Continuer", de: "Weiter", pt: "Continuar", ar: "\u0645\u062A\u0627\u0628\u0639\u0629", zh: "\u7EE7\u7EED", ja: "\u7D9A\u3051\u308B" },
  "support.title": { en: "Help & Support", es: "Ayuda y soporte", fr: "Aide et support", de: "Hilfe & Support", pt: "Ajuda e suporte", ar: "\u0627\u0644\u0645\u0633\u0627\u0639\u062F\u0629 \u0648\u0627\u0644\u062F\u0639\u0645", zh: "\u5E2E\u52A9\u4E0E\u652F\u6301", ja: "\u30D8\u30EB\u30D7\u3068\u30B5\u30DD\u30FC\u30C8" },
  "support.basic": { en: "Ask a question", es: "Haz una pregunta", fr: "Posez une question", de: "Frage stellen", pt: "Fa\u00e7a uma pergunta", ar: "\u0627\u0637\u0631\u062D \u0633\u0624\u0627\u0644\u0627\u064B", zh: "\u63D0\u95EE", ja: "\u8CEA\u554F\u3059\u308B" },
  "support.escalate": { en: "Contact Support", es: "Contactar soporte", fr: "Contacter le support", de: "Support kontaktieren", pt: "Contatar suporte", ar: "\u0627\u062A\u0635\u0644 \u0628\u0627\u0644\u062F\u0639\u0645", zh: "\u8054\u7CFB\u652F\u6301", ja: "\u30B5\u30DD\u30FC\u30C8\u306B\u9023\u7D61" },
  "theme.light": { en: "Light", es: "Claro", fr: "Clair", de: "Hell", pt: "Claro", ar: "\u0641\u0627\u062A\u062D", zh: "\u6D45\u8272", ja: "\u30E9\u30A4\u30C8" },
  "theme.dark": { en: "Dark", es: "Oscuro", fr: "Sombre", de: "Dunkel", pt: "Escuro", ar: "\u062F\u0627\u0643\u0646", zh: "\u6DF1\u8272", ja: "\u30C0\u30FC\u30AF" },
};

type I18nContextType = {
  lang: LangCode;
  setLang: (code: LangCode) => void;
  t: (key: string) => string;
  hasSelectedLanguage: boolean;
};

const I18nContext = createContext<I18nContextType>({
  lang: "en",
  setLang: () => {},
  t: (key: string) => key,
  hasSelectedLanguage: false,
});

const STORAGE_KEY = "contractai_lang";

export function I18nProvider({ children }: { children: ReactNode }) {
  const stored = localStorage.getItem(STORAGE_KEY) as LangCode | null;
  const [lang, setLangState] = useState<LangCode>(stored ?? "en");
  const hasSelectedLanguage = stored !== null;

  const setLang = useCallback((code: LangCode) => {
    setLangState(code);
    localStorage.setItem(STORAGE_KEY, code);
  }, []);

  const t = useCallback(
    (key: string) => {
      const entry = translations[key];
      if (!entry) return key;
      return entry[lang] ?? entry.en ?? key;
    },
    [lang],
  );

  return (
    <I18nContext.Provider value={{ lang, setLang, t, hasSelectedLanguage }}>
      {children}
    </I18nContext.Provider>
  );
}

export function useI18n() {
  return useContext(I18nContext);
}
