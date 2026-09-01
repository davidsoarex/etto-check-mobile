# E•Check

App web mobile para colaboradores registrarem fotos de rotinas operacionais (pontos críticos).

## Rodar localmente

```bash
npm install
npm run dev
```

Abre em `http://localhost:5175` (porta configurada no Vite).

## Produção

Produção (transição, os dois hosts servem o mesmo build):

- `https://check.etto.one`
- `https://check.salgadetto.com.br`

Ícone PWA: coloque a arte em `branding/echeck-icon-source.png` (ou `.jpg`) e rode `npm run icons:generate`.

Build:

```bash
npm run build
```

## Login

CPF + senha transacional (4 dígitos), igual aos demais portais do colaborador.
O colaborador precisa estar atribuído a pelo menos uma rotina ativa no ERP.
