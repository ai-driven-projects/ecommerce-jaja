/**
 * Padrão de Permissões RBAC
 * ########################
 *
 * Este arquivo define todas as permissões do sistema utilizando uma convenção RBAC.
 *
 * Formato do nome da permissão:
 *
 *   <dominio>.<contexto>.<acao>[.<escopo>]
 *
 * Onde:
 *  - dominio : Contexto delimitado de alto nível ou módulo (auth, product, branch, basic, ...)
 *  - contexto: Recurso ou submódulo dentro do domínio (user, role, module, product, ...)
 *  - acao    : Operação executada (view, create, read, update, delete)
 *  - escopo  : Escopo opcional de acesso (module, own, branch, ...)
 *
 * Exemplos:
 *   auth.module.view
 *   auth.user.create
 *   product.product.read
 *   basic.user.update.own
 */

import { PermissionDTO } from "../dto";
import { CriticalityLevel } from "../model";

/* ########################################################################## */
/*                                   ENUMS                                    */
/* ########################################################################## */

const ACTIONS = {
    VIEW: "view",
    CREATE: "create",
    READ: "read",
    UPDATE: "update",
    DELETE: "delete",
    CREATE_IN: "create_in",
    CREATE_OUT: "create_out",
    ADJUST: "adjust",
    TRANSFER: "transfer",
    CANCEL: "cancel",
    APPLY_DISCOUNT: "apply_discount",
    OVERRIDE_PRICE: "override_price",
} as const;

const SCOPES = {
    OWN: "own",
} as const;

const CONTEXTS = {
    MODULE: "module",
    USER: "user",
    ROLE: "role",
    PERMISSION: "permission",
    AUDIT: "audit",
    PRODUCT: "product",
    CATEGORY: "category",
    BRAND: "brand",
    BRANCH: "branch",
    CATALOG: "catalog",
    LOCATION: "location",
    STOCK_ITEM: "stock_item",
    MOVEMENT: "movement",
    ORDER: "order",
    DASHBOARD: "dashboard",
    REPORT: "report",
} as const;

/* ########################################################################## */
/*                             PERMISSION BUILDER                             */
/* ########################################################################## */

function permissionAlias(
    domain: string,
    context: string,
    action: string,
    scope?: string,
): string {
    return [domain, context, action, scope].filter(Boolean).join(".");
}

function definePermission(params: {
    id: string;
    name?: string;
    domain: string;
    context: string;
    action: string;
    scope?: string;
    description: string;
    criticality: CriticalityLevel;
}): PermissionDTO {
    const alias = permissionAlias(
        params.domain,
        params.context,
        params.action,
        params.scope,
    );

    return {
        id: params.id,
        name: params.name ?? alias,
        alias,
        description: params.description,
        criticality: params.criticality,
    };
}

/* ########################################################################## */
/*                               PERMISSIONS                                  */
/* ########################################################################## */

export const PERMISSIONS = {
    /* ################################ AUTH ################################= */

    AUTH: {
        MODULE: {
            VIEW: definePermission({
                id: "09395edc-3951-4357-8527-6f3a5a6a1ce3",
                name: "Acessar módulo de autenticação",
                domain: "auth",
                context: CONTEXTS.MODULE,
                action: ACTIONS.VIEW,
                description: "Permite acessar módulo de autenticação.",
                criticality: CriticalityLevel.LOW,
            }),
        },

        USER: {
            VIEW: definePermission({
                id: "00095edc-3951-4357-8447-6f3a5a6a1ce3",
                name: "Acessar seção de usuários",
                domain: "auth",
                context: CONTEXTS.USER,
                action: ACTIONS.VIEW,
                description:
                    "Permite visualizar a seção de usuários no módulo de autenticação.",
                criticality: CriticalityLevel.LOW,
            }),

            READ: definePermission({
                id: "dd239e4b-ce10-4b8f-be7f-93f291320249",
                name: "Visualizar usuários",
                domain: "auth",
                context: CONTEXTS.USER,
                action: ACTIONS.READ,
                description: "Permite visualizar usuários.",
                criticality: CriticalityLevel.LOW,
            }),

            CREATE: definePermission({
                id: "78f53f4c-ed17-42e3-80fd-5066963bea39",
                name: "Criar usuários",
                domain: "auth",
                context: CONTEXTS.USER,
                action: ACTIONS.CREATE,
                description: "Permite criar usuários.",
                criticality: CriticalityLevel.MEDIUM,
            }),

            UPDATE: definePermission({
                id: "bbd9d26e-164c-41da-8f88-849d30445a84",
                name: "Atualizar usuários",
                domain: "auth",
                context: CONTEXTS.USER,
                action: ACTIONS.UPDATE,
                description: "Permite atualizar usuários.",
                criticality: CriticalityLevel.HIGH,
            }),

            DELETE: definePermission({
                id: "4774520e-daca-462c-964f-5256123511e4",
                name: "Excluir usuários",
                domain: "auth",
                context: CONTEXTS.USER,
                action: ACTIONS.DELETE,
                description: "Permite excluir usuários.",
                criticality: CriticalityLevel.CRITICAL,
            }),
        },

        ROLE: {
            VIEW: definePermission({
                id: "00095edc-3951-4357-8527-6f3a5a6a1ce3",
                name: "Acessar seção de perfis",
                domain: "auth",
                context: CONTEXTS.ROLE,
                action: ACTIONS.VIEW,
                description:
                    "Permite visualizar a seção de perfis no módulo de autenticação.",
                criticality: CriticalityLevel.LOW,
            }),

            READ: definePermission({
                id: "659543e0-73ae-4c25-9561-e0bf85ecff4d",
                name: "Visualizar perfis",
                domain: "auth",
                context: CONTEXTS.ROLE,
                action: ACTIONS.READ,
                description: "Permite visualizar perfis.",
                criticality: CriticalityLevel.LOW,
            }),

            CREATE: definePermission({
                id: "327d3841-0101-4a01-b92f-0640ff1c0980",
                name: "Criar perfis",
                domain: "auth",
                context: CONTEXTS.ROLE,
                action: ACTIONS.CREATE,
                description: "Permite criar perfis.",
                criticality: CriticalityLevel.HIGH,
            }),

            UPDATE: definePermission({
                id: "087777f0-488f-4a70-a0fe-ec4215836ac4",
                name: "Atualizar perfis",
                domain: "auth",
                context: CONTEXTS.ROLE,
                action: ACTIONS.UPDATE,
                description: "Permite atualizar perfis.",
                criticality: CriticalityLevel.HIGH,
            }),

            DELETE: definePermission({
                id: "b98361ec-fe85-45c3-ac7d-ea299ceb9876",
                name: "Excluir perfis",
                domain: "auth",
                context: CONTEXTS.ROLE,
                action: ACTIONS.DELETE,
                description: "Permite excluir perfis.",
                criticality: CriticalityLevel.CRITICAL,
            }),
        },

        PERMISSION: {
            READ: definePermission({
                id: "59ff5cce-059a-4c7e-8d7a-55488100c44a",
                name: "Visualizar permissões",
                domain: "auth",
                context: CONTEXTS.PERMISSION,
                action: ACTIONS.READ,
                description: "Permite visualizar permissões.",
                criticality: CriticalityLevel.LOW,
            }),
        },

        AUDIT: {
            READ: definePermission({
                id: "f403264a-472c-4e1a-966a-fb5385f1e01c",
                name: "Visualizar auditoria",
                domain: "auth",
                context: CONTEXTS.AUDIT,
                action: ACTIONS.READ,
                description:
                    "Permite visualizar trilhas de auditoria e eventos sensíveis.",
                criticality: CriticalityLevel.MEDIUM,
            }),
        },
    },

    /* ################################ RODUCT ################################ */

    PRODUCT: {
        MODULE: {
            VIEW: definePermission({
                id: "c4b1a024-c5af-4893-a8be-b11a7a2717fa",
                name: "Acessar módulo de produtos",
                domain: "product",
                context: CONTEXTS.MODULE,
                action: ACTIONS.VIEW,
                description: "Permite acessar módulo de produtos.",
                criticality: CriticalityLevel.LOW,
            }),
        },

        READ: definePermission({
            id: "6c6ec5b0-df6e-417c-bf26-588cd907c4c1",
            name: "Visualizar produtos",
            domain: "product",
            context: CONTEXTS.PRODUCT,
            action: ACTIONS.READ,
            description: "Permite visualizar produtos.",
            criticality: CriticalityLevel.LOW,
        }),

        CREATE: definePermission({
            id: "37518656-9153-4155-a53f-9d9c62a146fd",
            name: "Criar produtos",
            domain: "product",
            context: CONTEXTS.PRODUCT,
            action: ACTIONS.CREATE,
            description: "Permite criar produtos.",
            criticality: CriticalityLevel.MEDIUM,
        }),

        UPDATE: definePermission({
            id: "d0c824ee-17a7-4c5e-be8c-afbae9f20285",
            name: "Atualizar produtos",
            domain: "product",
            context: CONTEXTS.PRODUCT,
            action: ACTIONS.UPDATE,
            description: "Permite atualizar produtos.",
            criticality: CriticalityLevel.MEDIUM,
        }),

        DELETE: definePermission({
            id: "70c88b3b-172c-439d-9bbc-4f533de5a597",
            name: "Excluir produtos",
            domain: "product",
            context: CONTEXTS.PRODUCT,
            action: ACTIONS.DELETE,
            description: "Permite excluir produtos.",
            criticality: CriticalityLevel.HIGH,
        }),

        CATEGORY: {
            READ: definePermission({
                id: "c3d4e5f6-a7b8-49c0-9def-0a1b2c3d4e5f",
                name: "Visualizar categorias",
                domain: "product",
                context: CONTEXTS.CATEGORY,
                action: ACTIONS.READ,
                description: "Permite visualizar categorias.",
                criticality: CriticalityLevel.LOW,
            }),

            CREATE: definePermission({
                id: "b1c2d3e4-f5a6-4789-8abc-9d0e1f2a3b4c",
                name: "Criar categorias",
                domain: "product",
                context: CONTEXTS.CATEGORY,
                action: ACTIONS.CREATE,
                description: "Permite criar categorias.",
                criticality: CriticalityLevel.MEDIUM,
            }),

            UPDATE: definePermission({
                id: "d4e5f6a7-b8c9-4a0b-adef-1b2c3d4e5f6a",
                name: "Atualizar categorias",
                domain: "product",
                context: CONTEXTS.CATEGORY,
                action: ACTIONS.UPDATE,
                description: "Permite atualizar categorias.",
                criticality: CriticalityLevel.MEDIUM,
            }),

            DELETE: definePermission({
                id: "e5f6a7b8-c9d0-4b1c-bdef-2c3d4e5f6a7b",
                name: "Excluir categorias",
                domain: "product",
                context: CONTEXTS.CATEGORY,
                action: ACTIONS.DELETE,
                description: "Permite excluir categorias.",
                criticality: CriticalityLevel.HIGH,
            }),
        },

        BRAND: {
            READ: definePermission({
                id: "f6a7b8c9-d0e1-4c2d-cdef-3d4e5f6a7b8c",
                name: "Visualizar marcas",
                domain: "product",
                context: CONTEXTS.BRAND,
                action: ACTIONS.READ,
                description: "Permite visualizar marcas.",
                criticality: CriticalityLevel.LOW,
            }),

            CREATE: definePermission({
                id: "a7b8c9d0-e1f2-4d3e-def0-4e5f6a7b8c9d",
                name: "Criar marcas",
                domain: "product",
                context: CONTEXTS.BRAND,
                action: ACTIONS.CREATE,
                description: "Permite criar novas marcas.",
                criticality: CriticalityLevel.MEDIUM,
            }),

            UPDATE: definePermission({
                id: "b8c9d0e1-f2a3-4e4f-ef01-5f6a7b8c9d0e",
                name: "Atualizar marcas",
                domain: "product",
                context: CONTEXTS.BRAND,
                action: ACTIONS.UPDATE,
                description: "Permite atualizar marcas existentes.",
                criticality: CriticalityLevel.MEDIUM,
            }),

            DELETE: definePermission({
                id: "c9d0e1f2-a3b4-4f50-f012-6a7b8c9d0e1f",
                name: "Excluir marcas",
                domain: "product",
                context: CONTEXTS.BRAND,
                action: ACTIONS.DELETE,
                description: "Permite excluir marcas.",
                criticality: CriticalityLevel.HIGH,
            }),
        },
    },

    /* ################################ BRANCH ################################ */

    BRANCH: {
        MODULE: {
            VIEW: definePermission({
                id: "ee4d58ac-28a8-4b26-959c-c213e938ee46",
                name: "Acessar módulo de filiais",
                domain: "branch",
                context: CONTEXTS.MODULE,
                action: ACTIONS.VIEW,
                description: "Permite acessar módulo de filiais.",
                criticality: CriticalityLevel.LOW,
            }),
        },

        READ: definePermission({
            id: "1a865f95-04d2-405b-b353-92214983ad9c",
            name: "Visualizar filiais",
            domain: "branch",
            context: CONTEXTS.BRANCH,
            action: ACTIONS.READ,
            description: "Permite visualizar filiais.",
            criticality: CriticalityLevel.LOW,
        }),

        CREATE: definePermission({
            id: "2901ecaa-2d22-484a-85fe-5223c12a326b",
            name: "Criar filiais",
            domain: "branch",
            context: CONTEXTS.BRANCH,
            action: ACTIONS.CREATE,
            description: "Permite criar filiais.",
            criticality: CriticalityLevel.HIGH,
        }),

        UPDATE: definePermission({
            id: "6eba5d29-a83c-4bab-981d-bd730b7af729",
            name: "Atualizar filiais",
            domain: "branch",
            context: CONTEXTS.BRANCH,
            action: ACTIONS.UPDATE,
            description: "Permite atualizar filiais.",
            criticality: CriticalityLevel.HIGH,
        }),

        DELETE: definePermission({
            id: "86491453-5f8b-4ccc-b8ea-1616cbd55811",
            name: "Excluir filiais",
            domain: "branch",
            context: CONTEXTS.BRANCH,
            action: ACTIONS.DELETE,
            description: "Permite excluir filiais.",
            criticality: CriticalityLevel.CRITICAL,
        }),
    },

    /* ################################ STOCK ################################ */

    STOCK: {
        MODULE: {
            VIEW: definePermission({
                id: "7fde8b19-7780-4c78-b5a0-5f46748c4429",
                name: "Acessar módulo de estoque",
                domain: "stock",
                context: CONTEXTS.MODULE,
                action: ACTIONS.VIEW,
                description: "Permite acessar módulo de estoque.",
                criticality: CriticalityLevel.LOW,
            }),
        },

        CATALOG: {
            READ: definePermission({
                id: "d1ea326e-b18f-4171-be9c-1dafd5d4895a",
                name: "Visualizar catálogo de estoques",
                domain: "stock",
                context: CONTEXTS.CATALOG,
                action: ACTIONS.READ,
                description: "Permite visualizar o catálogo de estoques.",
                criticality: CriticalityLevel.LOW,
            }),
        },

        LOCATION: {
            READ: definePermission({
                id: "7b0b1d6e-e16c-4aab-b828-79a2e43b392f",
                name: "Visualizar localizações de estoque",
                domain: "stock",
                context: CONTEXTS.LOCATION,
                action: ACTIONS.READ,
                description:
                    "Permite visualizar localizações de armazenamento dos estoques.",
                criticality: CriticalityLevel.LOW,
            }),

            CREATE: definePermission({
                id: "c1d7c485-b7fa-46e8-be84-acbcca5d483f",
                name: "Criar localizações de estoque",
                domain: "stock",
                context: CONTEXTS.LOCATION,
                action: ACTIONS.CREATE,
                description:
                    "Permite criar localizações de armazenamento dos estoques.",
                criticality: CriticalityLevel.MEDIUM,
            }),

            UPDATE: definePermission({
                id: "afea9dbf-2f6f-4929-b62c-a63566403d60",
                name: "Atualizar localizações de estoque",
                domain: "stock",
                context: CONTEXTS.LOCATION,
                action: ACTIONS.UPDATE,
                description:
                    "Permite atualizar localizações de armazenamento dos estoques.",
                criticality: CriticalityLevel.MEDIUM,
            }),
        },

        ITEM: {
            READ: definePermission({
                id: "484063a0-9ceb-4fe2-87d9-9ccd4ca55230",
                name: "Visualizar itens de estoque",
                domain: "stock",
                context: CONTEXTS.STOCK_ITEM,
                action: ACTIONS.READ,
                description: "Permite visualizar itens dentro dos estoques.",
                criticality: CriticalityLevel.LOW,
            }),
        },

        MOVEMENT: {
            READ: definePermission({
                id: "c8a6efed-5c91-491a-9ba3-ca9ae8758e3f",
                name: "Visualizar movimentações de estoque",
                domain: "stock",
                context: CONTEXTS.MOVEMENT,
                action: ACTIONS.READ,
                description: "Permite visualizar movimentações de estoque.",
                criticality: CriticalityLevel.LOW,
            }),

            CREATE_IN: definePermission({
                id: "04257f5e-5ae0-4243-9e76-dd5eb8218491",
                name: "Registrar entrada de estoque",
                domain: "stock",
                context: CONTEXTS.MOVEMENT,
                action: ACTIONS.CREATE_IN,
                description:
                    "Permite registrar entrada de itens no estoque (ex.: compras e devoluções).",
                criticality: CriticalityLevel.MEDIUM,
            }),

            CREATE_OUT: definePermission({
                id: "cf384d36-5423-4378-8ade-21323a5a3b11",
                name: "Registrar saída de estoque",
                domain: "stock",
                context: CONTEXTS.MOVEMENT,
                action: ACTIONS.CREATE_OUT,
                description:
                    "Permite registrar saída de itens no estoque (ex.: perdas e consumo interno).",
                criticality: CriticalityLevel.HIGH,
            }),

            ADJUST: definePermission({
                id: "524b1609-199d-4e5e-b517-f9e13d37cef4",
                name: "Ajustar saldo de estoque",
                domain: "stock",
                context: CONTEXTS.MOVEMENT,
                action: ACTIONS.ADJUST,
                description:
                    "Permite ajustar saldos de estoque fora do fluxo normal de entrada/saída.",
                criticality: CriticalityLevel.CRITICAL,
            }),

            TRANSFER: definePermission({
                id: "43032aa5-cb90-4af0-909d-eb949ccd1221",
                name: "Transferir estoque entre locais",
                domain: "stock",
                context: CONTEXTS.MOVEMENT,
                action: ACTIONS.TRANSFER,
                description:
                    "Permite registrar transferências de estoque entre filiais e locais.",
                criticality: CriticalityLevel.HIGH,
            }),
        },
    },

    /* ################################ SALES ################################ */

    SALES: {
        MODULE: {
            VIEW: definePermission({
                id: "f2c5791c-49cb-4ad2-b7fa-0399df2de7ce",
                name: "Acessar módulo de vendas",
                domain: "sales",
                context: CONTEXTS.MODULE,
                action: ACTIONS.VIEW,
                description: "Permite acessar módulo de vendas.",
                criticality: CriticalityLevel.LOW,
            }),
        },

        ORDER: {
            READ: definePermission({
                id: "5268e2dd-f560-47c9-8529-706f4716b9d0",
                name: "Visualizar pedidos de venda",
                domain: "sales",
                context: CONTEXTS.ORDER,
                action: ACTIONS.READ,
                description: "Permite visualizar pedidos de venda.",
                criticality: CriticalityLevel.LOW,
            }),

            CREATE: definePermission({
                id: "6602b3b1-89b8-4350-b3f1-fcbec95d55b0",
                name: "Criar pedidos de venda",
                domain: "sales",
                context: CONTEXTS.ORDER,
                action: ACTIONS.CREATE,
                description: "Permite criar pedidos de venda.",
                criticality: CriticalityLevel.MEDIUM,
            }),

            UPDATE: definePermission({
                id: "8afeebfe-c7a3-4330-baaf-fe6f22ec6f4f",
                name: "Atualizar pedidos de venda",
                domain: "sales",
                context: CONTEXTS.ORDER,
                action: ACTIONS.UPDATE,
                description: "Permite atualizar pedidos de venda.",
                criticality: CriticalityLevel.HIGH,
            }),

            DELETE: definePermission({
                id: "5c9d2edb-bbd3-4ce0-a222-94f177ae85c9",
                name: "Excluir pedidos de venda",
                domain: "sales",
                context: CONTEXTS.ORDER,
                action: ACTIONS.DELETE,
                description: "Permite excluir pedidos de venda.",
                criticality: CriticalityLevel.CRITICAL,
            }),

            CANCEL: definePermission({
                id: "bf8abc80-56a8-40f7-bfd2-4e80e90fe6d1",
                name: "Cancelar pedidos de venda",
                domain: "sales",
                context: CONTEXTS.ORDER,
                action: ACTIONS.CANCEL,
                description:
                    "Permite cancelar pedidos de venda concluídos ou em andamento.",
                criticality: CriticalityLevel.CRITICAL,
            }),

            APPLY_DISCOUNT: definePermission({
                id: "cd6d7f88-e9fc-4e8e-ab98-69b7b30e685c",
                name: "Aplicar desconto em pedidos",
                domain: "sales",
                context: CONTEXTS.ORDER,
                action: ACTIONS.APPLY_DISCOUNT,
                description:
                    "Permite aplicar descontos manuais em pedidos de venda.",
                criticality: CriticalityLevel.HIGH,
            }),

            OVERRIDE_PRICE: definePermission({
                id: "b512d912-fdd3-4b1a-ba77-afa08f77624e",
                name: "Sobrescrever preço de itens",
                domain: "sales",
                context: CONTEXTS.ORDER,
                action: ACTIONS.OVERRIDE_PRICE,
                description:
                    "Permite alterar manualmente o preço de venda de itens no pedido.",
                criticality: CriticalityLevel.CRITICAL,
            }),
        },
    },

    /* ################################ BASIC ################################ */

    BASIC: {
        USER: {
            READ_OWN: definePermission({
                id: "814ffc1c-4f1d-49ea-a526-56643947595a",
                name: "Visualizar o próprio usuário",
                domain: "basic",
                context: CONTEXTS.USER,
                action: ACTIONS.READ,
                scope: SCOPES.OWN,
                description: "Permite visualizar o próprio usuário.",
                criticality: CriticalityLevel.LOW,
            }),
            DELETE_OWN: definePermission({
                id: "d83b0a93-ab27-49c6-95bc-afdaa306bbab",
                name: "Deletar o próprio usuário",
                domain: "basic",
                context: CONTEXTS.USER,
                action: ACTIONS.DELETE,
                scope: SCOPES.OWN,
                description: "Permite deletar o próprio usuário.",
                criticality: CriticalityLevel.HIGH,
            }),

            UPDATE_OWN: definePermission({
                id: "45ab02be-8d00-47b9-a16e-df7e8f28caa7",
                name: "Atualizar o próprio usuário",
                domain: "basic",
                context: CONTEXTS.USER,
                action: ACTIONS.UPDATE,
                scope: SCOPES.OWN,
                description: "Permite atualizar o próprio usuário.",
                criticality: CriticalityLevel.MEDIUM,
            }),
        },
    },
} as const;
