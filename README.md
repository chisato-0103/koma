# Koma — 大学授業管理アプリ

大学の時間割・授業情報・出欠・ノートをローカルで一元管理するデスクトップアプリです。MoodleやTeams、シラバスへのリンクを授業ごとにまとめ、タブを横断する手間を解消します。

## 機能

- **時間割管理** — 月〜金・1〜6限のグリッド表示。2コマ連続授業にも対応
- **URL管理** — Moodle / Teams / シラバスのURLを授業ごとに登録しワンクリックで開く
- **出欠カウント** — セルホバーで即カウント。モーダルから数値の直接入力も可能
- **Markdownノート** — 授業ごと・回数ごとに `.md` ファイルで保存。編集／分割／プレビューの3モード対応
- **学期管理** — 前期・後期など複数学期の作成・切替・削除
- **大学ポータルリンク** — ヘッダーにポータルURLを登録してワンクリックアクセス

## 技術スタック

| 項目 | 採用技術 |
|------|---------|
| デスクトップフレームワーク | Electron 33 |
| フロントエンド | React 18 |
| ビルドツール | electron-vite |
| データベース | SQLite (better-sqlite3 v12) |

## セットアップ

```bash
npm install
npm run dev
```

初回起動時は各限の時間設定と学期名の入力を行うセットアップ画面が表示されます。

## データの保存場所

| データ | パス |
|--------|------|
| 時間割DB | `~/Library/Application Support/university-timetable/timetable.db` |
| ノート | `~/Library/Application Support/university-timetable/notes/`（変更可） |
| アプリ設定 | `~/Library/Application Support/university-timetable/settings.json` |

## 使い方

詳細は [使い方.md](使い方.md) を参照してください。
