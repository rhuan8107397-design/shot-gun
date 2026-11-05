# FPS Arena / FPS 竞技场

**A complete 3D first-person shooter that runs entirely in the browser. Open the HTML file and play — no install, no build step, no dependencies beyond a CDN-loaded Three.js.**

**一款完全在浏览器中运行的 3D 第一人称射击游戏。打开 HTML 文件即可游玩 —— 无需安装、无需构建、除 CDN 加载的 Three.js 外无任何依赖。**

---

## Quick Start / 快速开始

Open `FPS.html` in any modern browser. An internet connection is required on first load to fetch Three.js from the CDN.

Click **Start**, grant pointer lock, and play.

在现代浏览器中打开 `FPS.html`。首次加载需要网络连接以从 CDN 获取 Three.js。点击 **Start**，授权指针锁定，即可开始游戏。

---

## Controls / 操作说明

| Key / 按键 | Action / 功能 |
|---|---|
| `W A S D` | Move / 移动 |
| `Mouse` | Look around / 视角旋转 |
| `Left Click` | Fire (hold for full-auto on Rifle) / 射击（步枪可按住连发） |
| `Right Click` | Aim down sights (ADS) / 瞄准（开镜） |
| `1` `2` `3` | Switch weapon (Pistol / Rifle / Shotgun) / 切换武器 |
| `R` | Reload / 换弹 |
| `4` | Throw grenade (hold to charge, release to throw) / 投掷手雷（按住蓄力，松开投出） |
| `Space` | Jump / 跳跃 |
| `Shift` | Sprint (drains stamina) / 冲刺（消耗体力） |
| `Shift + Ctrl` | Slide (invincible during slide) / 滑铲（滑铲期间无敌） |
| `B` | Open upgrade shop (between waves) / 打开升级商店（波次间） |
| `Escape` | Close shop / pause / 关闭商店 / 暂停 |

---

## Weapons / 武器

| Weapon / 武器 | Mag / 弹匣 | Reserve / 备弹 | Damage / 伤害 | Notes / 备注 |
|---|---|---|---|---|
| Pistol / 手枪 | 15 | 60 | 34 | Semi-auto, tight spread / 半自动，精度高 |
| Rifle / 步枪 | 30 | 120 | 24 | Full-auto, all-rounder / 全自动，万金油 |
| Shotgun / 霰弹枪 | 8 | 40 | 18 × 5 pellets | Wide spread, devastating up close / 散布大，近战毁灭性 |
| Grenade / 手雷 | 1 | 3 | 100 AoE | Hold to charge, release to throw, area damage / 蓄力投掷，范围伤害 |

### Procedural Weapon Models / 程序化武器模型

All weapons are built programmatically from Three.js primitives (Box, Cylinder, Torus) — no external model files. Each weapon features 7–15 individual mesh parts with distinct materials (metal, polymer, wood), including functional details like slides, magazines, trigger guards, scopes, and iron sights.

所有武器均通过 Three.js 原生几何体（Box、Cylinder、Torus）程序化组合建模，不依赖任何外部模型文件。每把武器由 7~15 个独立 Mesh 部件组成，使用金属/聚合物/木质三种材质区分，包含滑套、弹匣、扳机护圈、瞄准镜、机械瞄具等功能细节。

---

## Gameplay / 游戏流程

1. Click **Start** to begin Wave 1. / 点击 **Start** 开始第一波。
2. Eliminate all enemies in the current wave. / 消灭当前波次所有敌人。
3. Between waves, press **B** to open the upgrade shop — spend score points on permanent upgrades. / 波次间隙按 **B** 打开升级商店，使用积分购买永久升级。
4. Survive 5 increasingly difficult waves. / 在难度递增的 5 波敌人中存活。
5. A boss spawns on Wave 5. Defeat it to win. / 第 5 波会出现 Boss，击败它即可获胜。

---

## Upgrades / 升级

Earn score by killing enemies. Spend it in the shop between waves.

通过击杀敌人获得积分，在波次间的商店中消费。

| Upgrade / 升级 | Effect / 效果 | Cost / 花费 | Max / 最高 |
|---|---|---|---|
| Firepower / 火力 | Weapon damage +10% / 武器伤害 +10% | 200 | 5 |
| Extended Mag / 扩容弹匣 | Magazine capacity +5 / 弹匣容量 +5 | 150 | 5 |
| Lightweight / 轻量化 | Move speed +8% / 移速 +8% | 150 | 3 |
| Quick Reload / 快速换弹 | Reload time -15% / 换弹时间 -15% | 150 | 3 |

---

## Features / 游戏特性

- **Procedural maps / 程序化地图** — rooms connected by corridors, randomly generated each reload
- **Wave system / 波次系统** — 5 waves with escalating enemy count and elite spawns
- **Boss fight / Boss 战** — a large enemy with ranged and charge attack modes on Wave 5
- **Combo system / 连击系统** — rapid kills build a combo multiplier that boosts score gain
- **Headshots / 爆头** — deal 2.5× damage and trigger a slow-motion effect
- **Explosive barrels / 爆炸桶** — shoot barrels to detonate them, dealing AoE damage
- **Grenades / 手雷** — hold-to-charge throwing mechanic, bounces off walls, arms after delay, AoE damage with falloff
- **Slide mechanic / 滑铲** — sprint then crouch to slide with invincibility frames
- **ADS system / 瞄准系统** — right-click to aim down sights; non-essential weapon parts auto-hide, FOV narrows, weapon scales down for clear sight picture
- **Minimap / 小地图** — radar showing walls, enemies (red), elites (orange), and the boss (purple)
- **Damage numbers / 伤害飘字** — floating damage indicators for hits, headshots, and armor breaks
- **Bullet decals / 弹痕** — bullet marks left on walls, scorch marks from barrel explosions
- **Custom crosshair / 自定义准星** — adjustable color, opacity, outline; settings persisted to localStorage
- **Dynamic crosshair / 动态准星扩散** — spread scales with movement, sprinting, sliding, and firing
- **Low-HP feedback / 低血量反馈** — screen-edge red vignette and heartbeat audio when health drops below 30
- **Synthesized audio / 合成音效** — all sound effects generated via Web Audio API (no audio files)
- **Soft morning lighting / 柔光晨间光照** — matte materials with warm ambient tones and breathing point lights
- **Persistent high score / 最高分记录** — best score saved to localStorage, displayed on game over
- **Single-file / 单文件** — entire game in one self-contained HTML file

---

## Tech Stack / 技术栈

- **Three.js** (CDN, v0.160) — 3D rendering / 3D 渲染
- **Web Audio API** — procedural sound effects / 程序化音效生成
- **Pointer Lock API** — mouse capture for FPS camera / 鼠标锁定
- **localStorage** — high score & crosshair config persistence / 分数与准星配置持久化

---

## License / 许可证

MIT
