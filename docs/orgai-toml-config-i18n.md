# orgai.toml Configuration Guide (Multilingual)

This document explains `orgai.toml` from **high-level overview** to **detailed key-by-key reference**.

---

## 1) English

### 1.1 Quick overview
`orgai.toml` controls how the `gb`/`mtg` CLI behaves:
- `[meeting]`: meeting flow constraints (e.g., allowed event types).
- `[paths]`: where session/runtime/output files are written.
- `[retrieval]`: how context files are searched and filtered.
- `[color]`: currently informational in `orgai.toml` (reserved for UI behavior).

If a key is omitted, built-in defaults are used.

### 1.2 Typical setup
1. Keep only the values you want to customize.
2. Delete optional keys safely; defaults apply.
3. Restart CLI command (`gb ...`) and verify behavior.

### 1.3 Detailed keys
- `[meeting]`
  - `end_keywords`: reserved end trigger words.
  - `allowed_event_types`: accepted `ev write` types.
- `[paths]`
  - `base_dir`, `session_file`, `event_dir`, `exec_file`
  - `minutes_dir`, `doc_file`, `issue_file`
- `[retrieval]`
  - `top_entries`, `top_inner_entries`, `max_sources`
  - `preview_lines`, `max_content_chars`
  - `excluded_dirs`, `excluded_extensions`, `fallback_files`

---

## 2) Français

### 2.1 Vue d’ensemble
`orgai.toml` définit le comportement CLI :
- `[meeting]` : règles de session.
- `[paths]` : chemins des fichiers d’état/sortie.
- `[retrieval]` : paramètres de recherche de contexte.
- `[color]` : section réservée (informatif).

Les clés absentes utilisent les valeurs par défaut.

### 2.2 Utilisation recommandée
1. Gardez seulement les clés à personnaliser.
2. Supprimez les autres clés sans risque.
3. Lancez `gb` pour valider le résultat.

### 2.3 Détails
- `allowed_event_types` contrôle les types permis pour `ev write`.
- `base_dir` est la racine des données runtime.
- `excluded_*` évite de scanner des chemins/extensions inutiles.
- `fallback_files` est utilisé si aucune source pertinente n’est trouvée.

---

## 3) Español

### 3.1 Resumen rápido
`orgai.toml` centraliza la configuración del CLI:
- `[meeting]`: reglas de reunión/eventos.
- `[paths]`: rutas de archivos de sesión y salidas.
- `[retrieval]`: límites/filtros de búsqueda de contexto.
- `[color]`: reservado (informativo por ahora).

Si faltan claves, se aplican valores predeterminados.

### 3.2 Flujo recomendado
1. Edita solo lo necesario.
2. Deja el resto sin definir.
3. Ejecuta `gb` y confirma resultados.

### 3.3 Claves importantes
- `top_entries` / `top_inner_entries`: amplitud de búsqueda.
- `preview_lines` / `max_content_chars`: costo de lectura.
- `max_sources`: número final de fuentes sugeridas.

---

## 4) 简体中文

### 4.1 概览
`orgai.toml` 用于控制 CLI 行为：
- `[meeting]`：会议与事件规则。
- `[paths]`：会话文件与输出文件路径。
- `[retrieval]`：上下文检索策略。
- `[color]`：目前主要作为预留配置（说明用途）。

未填写的配置项会自动使用默认值。

### 4.2 推荐使用方式
1. 只保留你要覆盖的键。
2. 其余键可以省略。
3. 重新运行 `gb` 验证效果。

### 4.3 关键项
- `allowed_event_types`：`ev write` 可接受的事件类型。
- `excluded_dirs` / `excluded_extensions`：检索时忽略的目录与扩展名。
- `fallback_files`：检索不到时的兜底文件。

---

## 5) 한국어

### 5.1 개요
`orgai.toml`은 CLI 동작을 설정합니다.
- `[meeting]`: 회의 이벤트 규칙
- `[paths]`: 런타임/출력 파일 경로
- `[retrieval]`: 컨텍스트 검색 방식
- `[color]`: 현재는 안내성(예약) 섹션

키를 생략하면 기본값이 자동 적용됩니다.

### 5.2 권장 절차
1. 필요한 키만 수정
2. 나머지는 생략
3. `gb` 실행 후 동작 확인

### 5.3 상세 포인트
- `base_dir` 변경 시 세션/이벤트/exec 파일 위치가 함께 바뀝니다.
- `max_content_chars`를 낮추면 검색 비용을 줄일 수 있습니다.

---

## 6) 日本語

### 6.1 概要
`orgai.toml` は CLI の挙動を一元設定します。
- `[meeting]`: 会議イベントのルール
- `[paths]`: セッション状態・出力先ファイル
- `[retrieval]`: コンテキスト探索の上限・除外条件
- `[color]`: 現状は予約的な設定セクション

未指定の項目は既定値が使われます。

### 6.2 使い方（段階的）
1. まずは `[paths]` だけを必要に応じて変更。
2. 次に `[meeting]` の `allowed_event_types` を運用に合わせる。
3. 最後に `[retrieval]` を調整して探索精度と速度をチューニング。

### 6.3 設定項目（詳細）
- `[meeting]`
  - `end_keywords`
  - `allowed_event_types`
- `[paths]`
  - `base_dir`, `session_file`, `event_dir`, `exec_file`
  - `minutes_dir`, `doc_file`, `issue_file`
- `[retrieval]`
  - `top_entries`, `top_inner_entries`, `max_sources`
  - `preview_lines`, `max_content_chars`
  - `excluded_dirs`, `excluded_extensions`, `fallback_files`

---

## 7) العربية (الفصحى)

### 7.1 نظرة عامة
ملف `orgai.toml` يضبط سلوك واجهة الأوامر:
- `[meeting]` لقواعد الجلسة والأحداث.
- `[paths]` لمسارات ملفات الحالة والمخرجات.
- `[retrieval]` لآلية البحث عن السياق.
- `[color]` قسم محجوز حاليًا (معلوماتي).

أي مفتاح غير مذكور يستخدم القيمة الافتراضية.

### 7.2 طريقة العمل المقترحة
1. عدّل المفاتيح التي تحتاجها فقط.
2. اترك الباقي بدون تعريف.
3. شغّل `gb` للتأكد من النتيجة.

### 7.3 نقاط تفصيلية
- `excluded_dirs` و `excluded_extensions` لتقليل الضوضاء في الفحص.
- `fallback_files` للرجوع إليها عند عدم العثور على مصدر مناسب.

---

## 8) हिन्दी

### 8.1 संक्षिप्त परिचय
`orgai.toml` CLI की सेटिंग्स नियंत्रित करता है:
- `[meeting]` : मीटिंग/इवेंट नियम
- `[paths]` : फाइल पाथ
- `[retrieval]` : कॉन्टेक्स्ट खोज पैरामीटर
- `[color]` : अभी मुख्यतः आरक्षित अनुभाग

अगर कोई कुंजी नहीं दी गई है, तो डिफ़ॉल्ट मान लागू होंगे।

### 8.2 सुझाया गया तरीका
1. केवल ज़रूरी कुंजियाँ बदलें।
2. बाकी कुंजियाँ छोड़ दें।
3. `gb` चलाकर सत्यापित करें।

### 8.3 मुख्य विवरण
- `max_sources` अंतिम चुने गए स्रोतों की सीमा है।
- `preview_lines` और `max_content_chars` प्रदर्शन को प्रभावित करते हैं।

---

## 9) Русский

### 9.1 Обзор
`orgai.toml` управляет поведением CLI:
- `[meeting]` — правила событий встречи.
- `[paths]` — пути к runtime/выходным файлам.
- `[retrieval]` — параметры поиска контекста.
- `[color]` — резервный информационный раздел.

Если ключ не указан, используется значение по умолчанию.

### 9.2 Рекомендуемый порядок
1. Сначала настройте только пути.
2. Затем типы событий.
3. После этого — параметры поиска.

### 9.3 Детали
- `excluded_dirs`/`excluded_extensions` уменьшают шум при сканировании.
- `fallback_files` используются при отсутствии релевантных результатов.

---

## 10) Key reference (language-neutral)

| Section | Key | Purpose |
|---|---|---|
| meeting | end_keywords | Reserved keyword list for end-like phrases |
| meeting | allowed_event_types | Allowed event types accepted by `ev write` |
| paths | base_dir | Root runtime directory |
| paths | session_file | Session state filename under `base_dir` |
| paths | event_dir | Event log directory under `base_dir` |
| paths | exec_file | Execution log file under `base_dir` |
| paths | minutes_dir | Markdown minutes output directory |
| paths | doc_file | Curated decisions markdown file |
| paths | issue_file | Task markdown file |
| retrieval | top_entries | Number of top root entries to inspect |
| retrieval | top_inner_entries | Number of inner entries per directory |
| retrieval | max_sources | Max sources in final shortlist |
| retrieval | preview_lines | Number of lines for file preview |
| retrieval | max_content_chars | Max chars read for scoring |
| retrieval | excluded_dirs | Directories skipped during discovery |
| retrieval | excluded_extensions | File extensions skipped during discovery |
| retrieval | fallback_files | Default files when no relevant sources exist |

