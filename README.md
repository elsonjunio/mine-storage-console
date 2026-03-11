# MINE — Documentação em Português

> Documentação em inglês: [README.en.md](README.md)

---

## O que é o MINE?

**MINE** significa *MINE Is Not Enterprise* (MINE Não É Enterprise).

É uma plataforma de gerenciamento de armazenamento de objetos leve, limpa e sem as complexidades de soluções enterprise. O projeto é licenciado sob MIT, o que significa que qualquer pessoa pode usar, modificar, redistribuir ou comercializar livremente.

---

## Status atual

| Componente | Status |
|---|---|
| Backend (API REST) | ✅ Funcional |
| Servidor MCP | ✅ Funcional |
| Frontend (dashboard) | ✅ Utilizável |

O frontend chegou a um nível utilizável, cobrindo as principais operações do dia a dia: buckets, objetos, políticas, usuários, grupos, cotas e credenciais.

---

## Dependências externas

### Keycloak (autenticação)

O MINE **não gerencia autenticação de usuários por conta própria**. Ele delega completamente essa responsabilidade a um provedor OpenID Connect externo — na configuração padrão, o [Keycloak](https://www.keycloak.org/).

O fluxo de autenticação funciona da seguinte forma:

```
Usuário → Keycloak (login OIDC) → token Keycloak
       → MINE Backend (troca por token interno)
       → acesso às APIs e ao dashboard
```

O frontend implementa o fluxo **Authorization Code com PKCE**. Após o login no Keycloak, o código de autorização é enviado ao backend via `/auth/callback`, que valida o token junto ao Keycloak e emite um token interno de sessão (JWT assinado internamente).

**Configuração mínima necessária no Keycloak:**

- Um realm dedicado ao MINE
- Um client configurado com tipo `confidential` ou `public` e o fluxo Authorization Code habilitado
- Um claim de roles no token (padrão: campo `policy`)
- Usuários com a role `consoleAdmin` terão acesso às funcionalidades administrativas

As variáveis de ambiente necessárias:

```env
KEYCLOAK_URL=https://<seu-keycloak>/
KEYCLOAK_REALM=<seu-realm>
KEYCLOAK_CLIENT_ID=<seu-client-id>
KEYCLOAK_CLIENT_SECRET=<seu-client-secret>
OPENID_ROLE_CLAIM=policy
ADMIN_ROLE=consoleAdmin
```

> Embora o Keycloak seja a implementação de referência, qualquer provedor OpenID Connect compatível pode ser utilizado, desde que emita tokens JWT com os claims esperados.

---

## Provedores de armazenamento

### Arquitetura baseada em contratos (`mine-spec`)

O MINE é construído sobre um conjunto de contratos abstratos definidos no repositório [`mine-spec`](https://github.com/elsonjunio/mine-spec). Esses contratos definem as **portas** (interfaces) que o backend utiliza para se comunicar com o armazenamento de objetos e com o sistema de administração de usuários.

Isso significa que o MINE é **agnóstico ao provedor**. Qualquer serviço de armazenamento compatível com S3 pode ser integrado implementando os contratos do `mine-spec` em um novo adaptador.

```
mine-spec          →   define os contratos (portas)
mine-adapter-*     →   implementa os contratos para um provedor específico
mine (este repo)   →   usa somente os contratos, nunca o adaptador diretamente
```

### Adaptador disponível

| Adaptador | Provedor | Licença | Repositório |
|---|---|---|---|
| `mine-adapter-minio` | MinIO | AGPL-3.0 | [mine-adapter-minio](https://github.com/elsonjunio/mine-adapter-minio) |

> **No momento, o único adaptador disponível é o `mine-adapter-minio`.**
> Suporte a outros provedores (AWS S3, Azure Blob Storage, etc.) depende da criação de novos adaptadores que implementem os contratos do `mine-spec`.

### Como implementar um novo adaptador

Para suportar um novo provedor, implemente as interfaces definidas em `mine-spec`:

- `ObjectStoragePort` — operações sobre buckets e objetos (lista, upload, download, políticas, lifecycle, etc.)
- `UserAdminPort` — gerenciamento de usuários, grupos, políticas, cotas e credenciais

Publique o adaptador como um pacote Python e configure as variáveis:

```env
ADMIN_PATH=meu_adaptador.factory
S3_CLIENT_PATH=meu_adaptador.factory
```

O backend carrega os adaptadores dinamicamente via `importlib`, sem necessidade de alteração no código do MINE.

---

## Instalação e execução

### Requisitos

- Python 3.11+
- [Poetry](https://python-poetry.org/)
- Node.js 18+ (para o frontend)
- Keycloak (ou provedor OIDC compatível)
- MinIO (ou provedor S3 compatível com adaptador disponível)
- Redis (opcional — usado para cache e busca global; sem ele o sistema funciona normalmente)

### Backend

```bash
git clone https://github.com/elsonjunio/mine-storage-console.git
cd mine-storage-console

# Instalar dependências
poetry install

# Configurar variáveis de ambiente
cp .env.example .env
# Edite o .env com seus valores

# Iniciar o servidor (porta 8000)
poetry run uvicorn mine_backend.main:app --reload
```

Exemplo de `.env`:

```env
S3_REGION=us-east-1
S3_ENDPOINT=localhost:9000
S3_ACCESS_KEY=minioadmin
S3_SECRET_KEY=minioadmin
S3_SECURE=false

KEYCLOAK_URL=http://localhost:8080/
KEYCLOAK_REALM=mine
KEYCLOAK_CLIENT_ID=mine-console
KEYCLOAK_CLIENT_SECRET=seu-secret

OPENID_ROLE_CLAIM=policy
ADMIN_ROLE=consoleAdmin

INTERNAL_TOKEN_SECRET=troque-este-valor
INTERNAL_TOKEN_EXP_MINUTES=30

ADMIN_PATH=mine_adapter_minio.factory
S3_CLIENT_PATH=mine_adapter_minio.factory
```

### Frontend

```bash
cd mine_ui

# Instalar dependências
npm install

# Iniciar em modo desenvolvimento (porta 4200)
npm run start

# Build para produção
npm run build
```

---

## Funcionalidades do dashboard

| Tela | Funcionalidades |
|---|---|
| **Buckets** | Listar, criar, excluir buckets; gerenciar versionamento, política de acesso, lifecycle, eventos e cotas por bucket |
| **Objetos** | Navegar por pastas, upload/download, copiar, mover, excluir; metadados, tags e versionamento por objeto |
| **Políticas** | Criar e excluir políticas IAM; anexar a usuários e grupos |
| **Usuários** | Criar, habilitar, desabilitar e excluir usuários de armazenamento; anexar políticas |
| **Grupos** | Criar grupos, gerenciar membros e políticas associadas |
| **Cotas** | Visão geral de uso e cotas; definir quota global ou por bucket |
| **Credenciais** | Criar e revogar credenciais de service account com escopo de política |
| **Notificações** | Configurar destinos de notificação (webhook, Kafka, AMQP, etc.) |
| **Busca global** | Buscar buckets, objetos, usuários, grupos e políticas em tempo real |

---

## 🤖 Servidor MCP

O MINE expõe um servidor [Model Context Protocol (MCP)](https://modelcontextprotocol.io) que permite que assistentes de IA e ferramentas de automação gerenciem recursos de armazenamento de forma programática.

### Endpoint

O servidor MCP está disponível em:

```
http://localhost:8000/mcp
```

Utiliza o transporte **Streamable HTTP** (sessões com estado sobre HTTP).

### Autenticação

Todas as ferramentas MCP recebem um parâmetro `token` — um token de sessão interno emitido pelo backend do MINE após um login bem-sucedido.

Obtenha um token chamando o endpoint REST `/auth/callback` (fluxo OIDC via frontend) ou trocando diretamente um token Keycloak pelo endpoint `/auth/`. Em seguida, passe o token retornado para qualquer chamada de ferramenta MCP.

Ferramentas que operam em recursos exclusivos de administradores (usuários, grupos, políticas, cotas, credenciais, notificações) retornarão `PermissionDeniedError` se o token não possuir a role de admin.

### Ferramentas disponíveis

#### Buckets

| Ferramenta | Descrição |
|---|---|
| `list_buckets` | Lista todos os buckets visíveis ao usuário autenticado |
| `create_bucket` | Cria um novo bucket |
| `delete_bucket` | Exclui um bucket vazio |
| `get_bucket_versioning` | Obtém o status de versionamento de um bucket |
| `set_bucket_versioning` | Habilita ou suspende o versionamento de um bucket |
| `get_bucket_quota` | Obtém a quota de armazenamento de um bucket *(admin)* |
| `set_bucket_quota` | Define uma quota de armazenamento em um bucket *(admin)* |
| `get_bucket_usage` | Obtém a contagem de objetos e tamanho atual de um bucket |
| `get_bucket_policy` | Recupera o documento de política S3 do bucket |
| `put_bucket_policy` | Aplica uma política S3 ao bucket, substituindo qualquer existente |
| `delete_bucket_policy` | Remove a política do bucket |
| `validate_bucket_policy` | Valida um documento de política sem aplicá-lo |
| `get_bucket_lifecycle` | Recupera a configuração de lifecycle |
| `put_bucket_lifecycle` | Aplica uma configuração de lifecycle |
| `delete_bucket_lifecycle` | Remove a configuração de lifecycle |
| `validate_bucket_lifecycle` | Valida uma configuração de lifecycle sem aplicá-la |
| `get_bucket_events` | Recupera a configuração de notificação de eventos |
| `put_bucket_events` | Aplica uma configuração de notificação de eventos |
| `delete_bucket_events` | Remove todas as configurações de notificação de eventos |

#### Objetos

| Ferramenta | Descrição |
|---|---|
| `list_objects` | Lista objetos em um bucket, com filtro de prefixo e paginação opcionais |
| `delete_object` | Exclui um objeto |
| `copy_object` | Copia um objeto para um novo local |
| `move_object` | Move um objeto (copia e exclui a origem) |
| `generate_upload_url` | Gera uma URL presignada PUT para upload direto |
| `generate_download_url` | Gera uma URL presignada GET para download direto |
| `list_object_versions` | Lista todas as versões de um objeto |
| `delete_object_version` | Exclui permanentemente uma versão específica de um objeto |
| `restore_object_version` | Restaura uma versão anterior como a versão mais recente |
| `get_object_metadata` | Recupera metadados do objeto sem baixar o conteúdo |
| `update_object_metadata` | Substitui todos os metadados customizados de um objeto |
| `get_object_tags` | Recupera as tags de um objeto |
| `update_object_tags` | Substitui todas as tags de um objeto |

#### Políticas *(admin)*

| Ferramenta | Descrição |
|---|---|
| `list_policies` | Lista todas as políticas de armazenamento |
| `get_policy` | Obtém uma política pelo nome |
| `get_policy_groups` | Lista todos os grupos que possuem uma política anexada |
| `create_policy` | Cria uma nova política com um documento IAM |
| `delete_policy` | Exclui uma política pelo nome |
| `attach_policy` | Anexa uma política a um usuário |
| `detach_policy` | Desanexa uma política de um usuário |

#### Usuários *(admin)*

| Ferramenta | Descrição |
|---|---|
| `list_users` | Lista todos os usuários de armazenamento |
| `get_user` | Obtém detalhes de um usuário específico |
| `create_user` | Cria um novo usuário de armazenamento |
| `delete_user` | Exclui um usuário de armazenamento |
| `enable_user` | Habilita um usuário desabilitado |
| `disable_user` | Desabilita um usuário, revogando o acesso ao armazenamento |

#### Grupos *(admin)*

| Ferramenta | Descrição |
|---|---|
| `list_groups` | Lista todos os grupos de armazenamento |
| `get_group` | Obtém detalhes do grupo incluindo membros e políticas |
| `create_group` | Cria um novo grupo |
| `delete_group` | Exclui um grupo |
| `add_users_to_group` | Adiciona usuários a um grupo |
| `remove_users_from_group` | Remove usuários de um grupo |
| `enable_group` | Habilita um grupo desabilitado |
| `disable_group` | Desabilita um grupo, suspendendo a herança de políticas |
| `attach_policy_to_group` | Anexa uma política a um grupo |
| `detach_policy_from_group` | Desanexa uma política de um grupo |
| `get_group_policies` | Lista todas as políticas anexadas a um grupo |

#### Cotas *(admin)*

| Ferramenta | Descrição |
|---|---|
| `get_quotas_overview` | Obtém visão geral de uso e cotas de todos os buckets |
| `set_global_quota` | Aplica a mesma quota a todos os buckets |
| `remove_bucket_quota` | Remove a quota de um bucket específico |

#### Credenciais *(admin)*

| Ferramenta | Descrição |
|---|---|
| `list_credentials` | Lista credenciais de service account de um usuário |
| `create_credential` | Cria uma credencial de service account com escopo de política |
| `delete_credential` | Exclui uma credencial pelo access key |

#### Notificações de admin *(admin)*

| Ferramenta | Descrição |
|---|---|
| `list_admin_notification_targets` | Lista destinos de notificação por tipo |
| `create_admin_notification_target` | Cria um novo destino de notificação |
| `delete_admin_notification_target` | Exclui um destino de notificação |

---

### Testando com o MCP Inspector

[`@modelcontextprotocol/inspector`](https://github.com/modelcontextprotocol/inspector) é uma ferramenta interativa baseada em navegador para explorar e chamar ferramentas MCP manualmente.

**Requisito:** Node.js 18+ instalado.

#### 1. Inicie o backend

```bash
poetry run uvicorn mine_backend.main:app --reload
```

#### 2. Inicie o inspector

```bash
npx @modelcontextprotocol/inspector
```

Isso abre a interface do inspector em `http://localhost:5173` (ou na porta exibida no terminal).

#### 3. Conecte ao MINE

Na interface do inspector:

1. Defina o **Transporte** como `Streamable HTTP`
2. Defina a **URL** como `http://localhost:8000/mcp`
3. Clique em **Connect**

O inspector descobrirá todas as ferramentas disponíveis automaticamente.

#### 4. Obtenha um token de sessão

Antes de chamar qualquer ferramenta, é necessário um token válido. Troque um token Keycloak por um token interno via curl:

```bash
curl -s -X POST http://localhost:8000/auth/ \
  -H "Authorization: Bearer <seu-token-keycloak>" \
  | jq '.data.access_token'
```

Copie o valor retornado.

#### 5. Chame uma ferramenta

No inspector, selecione qualquer ferramenta (ex: `list_buckets`), preencha o campo `token` com o valor obtido acima e clique em **Run Tool**.

> **Dica:** Ferramentas marcadas com *(admin)* nas tabelas acima exigem um token emitido para um usuário que possua a role `consoleAdmin`. Chamá-las com um token de usuário comum retornará `PermissionDeniedError`.

---

## Licença

Este projeto é licenciado sob a **Licença MIT**.

Consulte o arquivo `LICENSE` para detalhes.

---

## Aviso de independência

O MINE é um projeto independente e não possui afiliação, endosso ou patrocínio de nenhum fornecedor de armazenamento.

Quaisquer nomes de terceiros mencionados são marcas registradas de seus respectivos proprietários.
