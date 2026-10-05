# Ventas Mostrador HPA

Mini sistema de cotización y venta de mostrador para un negocio de aluminio, vidrio y herrajes.
Next.js 15 (App Router) + MongoDB (Mongoose), listo para desplegar en Vercel con MongoDB Atlas.

## Qué hace

- **Mostrador**: busca productos, captura cantidades y calcula los totales al instante. Funciona en celular, tablet y PC.
- **Formas de venta por producto**:
  | Tipo | Se vende como | Cálculo |
  |---|---|---|
  | `pieza` | pieza, juego, caja, par… | cantidad × precio |
  | `kg` | kilos (con decimales), p. ej. esmeril | kilos × precio/kg |
  | `metro` | metros lineales, p. ej. felpa, vinil | metros × precio/m |
  | `perfil` | **tira completa** (6 m, 3.60 m, 4.60 m… cada largo con su precio) o **tramo** desde 50 cm | tramo = largo × precio/m |
  | `vidrio` | **hoja completa** o **a medida** (base × altura) | m² × precio/m²; valida que la medida quepa en la hoja |
- **Pagos**: efectivo (calcula el cambio), transferencia (sin cargo) y terminal. En terminal el vendedor
  captura la comisión (4 %, 4.6 %, 5 %…) y se suma **sobre el total**. La sugerida se configura en Ajustes.
- **Cotizaciones → venta**: se guardan con folio `C-000001`, vigencia configurable (7 días por defecto).
  Si sigue vigente al convertirla se respetan los precios cotizados; si venció se recalcula con los precios actuales.
- **Nota imprimible** (folio `V-000001`), **descarga en PDF** y **envío del PDF por WhatsApp** al cliente (WhatsApp Cloud API de Meta).
- **Lista de precios editable**: alta/edición de productos, **subir/bajar precios por porcentaje** (todo o por categoría,
  con redondeo y vista previa), **importar/exportar CSV** (edítala en Excel y vuelve a subirla) e **historial de cambios
  de precio** por producto (quién, cuándo, de cuánto a cuánto).
- **Tablero** para el administrador: vendido, número de ventas, ticket promedio, comisiones de terminal,
  ventas por día, por método de pago, por vendedor, por categoría, productos más vendidos y conversión de cotizaciones.
- **Cancelaciones** con motivo (solo el administrador cancela ventas); no cuentan en estadísticas.
- **Editar cotizaciones guardadas**: «Agregar o quitar productos» la abre en el mostrador; lo que ya estaba conserva
  el precio cotizado (si sigue vigente) y lo nuevo entra a precio actual. Se guarda en el mismo folio o se cobra directo.
- **Clientes**: se registran solos al vender/cotizar con nombre; buscador en el mostrador (nombre o teléfono) y módulo
  con alta, edición, historial, saldo y botón «Vender».
- **Datos de facturación**: varias razones sociales por cliente (RFC, régimen, uso de CFDI, C.P., correo) con botón
  «Copiar» para pegarlos en tu sistema de facturación. No timbra.
- **Clientes preferenciales y pagos parciales**: el encargado/admin marca al cliente como preferencial (con límite de
  crédito opcional); en la venta se activa «Pago parcial», queda el saldo y luego se registran **abonos** (cualquier
  método; en terminal la comisión se cobra sobre el abono). Lista de **Cuentas por cobrar**.
- **Caja**: entradas y salidas por concepto, **caja chica** con saldo propio («Poner fondo» / «Gasto»), traspasos entre
  cajas y **corte de caja**: fondo + ventas y abonos en efectivo + entradas − salidas = esperado, contra lo contado
  (por denominación o total), con faltante/sobrante, retiro (fuera o a caja chica), fondo que queda e impresión.
- **Devoluciones y cambios** (folio `D-000001`): se busca la venta con un solo buscador — folio de la nota (`V-123`),
  de la cotización de la que salió (`C-45`), de una devolución anterior (`D-7`), nombre del cliente aunque no esté
  registrado (sin importar acentos), parte del teléfono o el producto. Se marca qué regresa (al **precio que pagó**;
  la comisión de terminal no se regresa) y, si es cambio, qué se lleva (a **precio actual**). Tres formas de resolverlo:
  | Forma | Ejemplo: regresa tira de $450, se lleva una de $589 |
  |---|---|
  | **Con diferencia** | Se cobran $139 (efectivo, transferencia o terminal). Al revés, se regresan $139 en efectivo de la caja. |
  | **Cortesía** (sin diferencia) | No se cobra ni se regresa nada; queda registrado cuánto absorbió el negocio. |
  | **Cobrar lo nuevo completo** | Se cobran los $589; lo devuelto no se acredita (sin reembolso). |
  No deja devolver más de lo vendido (lleva la cuenta por renglón), si la nota debía saldo primero se abona ahí,
  y entra al corte de caja (diferencias cobradas en efectivo suman, reembolsos restan). También hay **devolución sin nota**
  (a precio de lista). Cada una tiene nota imprimible y se consulta en *Devoluciones y cambios*, en la venta y en el cliente.
- **Paginación con MongoDB** (skip/limit + conteo) en todas las listas; el mostrador carga resultados por páginas.

## Roles

| Rol | Puede |
|---|---|
| **Administrador** | Todo: tablero, usuarios, ajustes, precios, ventas de todos, cancelar ventas. |
| **Encargado de precios** | Editar productos y precios, importar listas, ajustes masivos, vender y ver todas las ventas. |
| **Vendedor / mostrador** | Cotizar y vender, consultar la lista de precios (solo lectura) y ver **sus** ventas. Ve todas las cotizaciones para poder cobrar las de otros compañeros. |

Los permisos se validan en el servidor (no solo se ocultan botones) y el servidor **siempre recalcula los precios**
con la base de datos antes de guardar una venta.

## Correr en tu computadora

Requisitos: Node.js 20+ y una base MongoDB (Atlas gratis o local).

```bash
npm install
cp .env.example .env.local      # y edita los valores
npm run seed                     # crea el administrador
npm run seed -- --demo           # (opcional) + productos de ejemplo + usuario "mostrador"
npm run dev                      # http://localhost:3000
npm test                         # pruebas de cálculo de precios
```

## Base de datos en MongoDB Atlas

1. Crea una cuenta en <https://www.mongodb.com/cloud/atlas> y un cluster **M0 (gratis)**.
2. *Database Access*: crea un usuario con contraseña.
3. *Network Access*: agrega `0.0.0.0/0` (Vercel no tiene IP fija).
4. *Connect → Drivers*: copia la cadena y agrégale el nombre de la base: `...mongodb.net/herrajes?retryWrites=true&w=majority`.

## Desplegar en Vercel

1. Sube esta carpeta a un repositorio de GitHub.
2. En <https://vercel.com> → *Add New → Project* → importa el repo (detecta Next.js solo).
3. En *Environment Variables* agrega:
   - `MONGODB_URI` — la cadena de Atlas
   - `AUTH_SECRET` — un texto largo aleatorio (`openssl rand -base64 32`)
4. *Deploy*.
5. Crea el administrador desde tu computadora apuntando a la base de producción:
   pon el mismo `MONGODB_URI` en tu `.env.local` y corre `npm run seed`.

Opcional: `NEXT_PUBLIC_TZ` (por defecto `America/Mexico_City`) y `NEXT_PUBLIC_TZ_OFFSET` (por defecto `-06:00`)
para los cortes por día.

## Enviar PDF por WhatsApp (WhatsApp Cloud API de Meta)

En cada nota o cotización hay un botón **WhatsApp**: el vendedor confirma el teléfono del cliente y el sistema
genera el PDF y se lo manda como documento desde el número del negocio. Si todavía no configuras Meta,
el botón ofrece mandar el resumen en texto con el WhatsApp del vendedor (como antes) y el botón **PDF** descarga el archivo.

> Necesitas un número de teléfono que **no** esté usando la app de WhatsApp ni WhatsApp Business en un celular
> (puede ser un número nuevo o uno fijo que reciba SMS o llamada). Si lo usas en la API, deja de funcionar en la app.

### 1. Cuenta de Meta Business

1. Entra a <https://business.facebook.com> con tu Facebook y crea un **portafolio comercial** (nombre del negocio, tu correo).
2. Opcional pero recomendado: *Configuración del negocio → Centro de seguridad → Verificación del negocio*
   (sube constancia de situación fiscal o comprobante de domicilio). Sin verificar puedes enviar a pocos clientes nuevos por día.

### 2. App con WhatsApp

1. Ve a <https://developers.facebook.com/apps> → **Crear app** → caso de uso **"Conectarse con clientes a través de WhatsApp"**
   (o tipo *Negocios*) → elige tu portafolio comercial.
2. En la app, entra a **WhatsApp → Configuración de la API** (*API Setup*). Meta te da un número de prueba;
   con él solo puedes mandar a 5 números que registres en "Para" (sirve para probar hoy mismo).
3. Para tu número real: **Agregar número de teléfono** → nombre visible (p. ej. "Herrajes HPA") → verifica con SMS o llamada.
4. Copia el **Identificador del número de teléfono** (*Phone number ID*, un número largo). Ese va en `WHATSAPP_PHONE_NUMBER_ID`.
5. Agrega un método de pago en *WhatsApp Manager → Configuración de la cuenta → Pagos*
   (los mensajes de plantilla de utilidad tienen un costo bajo por mensaje; revisa las tarifas de México en Meta).

### 3. Token permanente

El token que aparece en *API Setup* dura 24 horas. Para uno permanente:

1. *Configuración del negocio* → **Usuarios → Usuarios del sistema** → **Agregar** → nombre "ventas-hpa", rol **Administrador**.
2. **Asignar activos**: tu app (control total) y tu cuenta de WhatsApp (control total).
3. **Generar token** → elige tu app → caducidad **Nunca** → permisos `whatsapp_business_messaging` y `whatsapp_business_management`.
4. Copia el token (solo se muestra una vez). Ese va en `WHATSAPP_TOKEN`. Trátalo como contraseña.

### 4. Plantilla del mensaje

Meta exige una plantilla aprobada para escribir primero a un cliente. En **WhatsApp Manager → Plantillas de mensajes → Crear plantilla**:

| Campo | Valor |
|---|---|
| Categoría | **Utilidad** |
| Nombre | `nota_pdf` (minúsculas y guion bajo) |
| Idioma | **Español (MEX)** → `es_MX` |
| Encabezado | **Multimedia → Documento** (sube cualquier PDF de ejemplo) |
| Cuerpo | ver abajo |
| Pie (opcional) | `Herrajes HPA` |

Cuerpo (respeta el orden de las variables):

```text
Hola {{1}}, te compartimos tu {{2}} con folio {{3}} por un total de {{4}}. Cualquier duda, responde a este mensaje.
```

Ejemplos que pide Meta: `{{1}}` Juan Pérez · `{{2}}` cotización · `{{3}}` C-000123 · `{{4}}` $1,250.00.

Envíala a revisión; normalmente se aprueba en minutos. Si usas otro nombre, idioma o menos variables,
ajústalo en `WHATSAPP_TEMPLATE_NAME`, `WHATSAPP_TEMPLATE_LANG` y `WHATSAPP_TEMPLATE_BODY_PARAMS`.

### 5. Variables de entorno

En `.env.local` (y en Vercel → *Settings → Environment Variables*, luego **Redeploy**):

```bash
WHATSAPP_TOKEN="EAAG..."
WHATSAPP_PHONE_NUMBER_ID="123456789012345"
WHATSAPP_TEMPLATE_NAME="nota_pdf"
WHATSAPP_TEMPLATE_LANG="es_MX"
WHATSAPP_TEMPLATE_BODY_PARAMS="4"
```

### Problemas comunes

| Mensaje en el sistema | Qué hacer |
|---|---|
| "El token… no es válido o expiró" | Usa el token permanente del paso 3. |
| "…no está en la lista de destinatarios permitidos" | Estás con el número de prueba: agrega el número del cliente en *API Setup → Para*, o usa tu número real. |
| "La plantilla no existe o no está aprobada" | Revisa nombre e idioma exactos y que diga *Activa*. |
| "La cantidad de variables no coincide" | Ajusta `WHATSAPP_TEMPLATE_BODY_PARAMS` al número de `{{n}}` de tu plantilla. |
| "El número no tiene WhatsApp" | Confirma el teléfono con el cliente. |

Cada envío queda registrado en la venta (fecha, número y quién lo mandó) y se muestra en el diálogo.
Si la venta no tenía teléfono, se guarda el que capturaste.

## Cargar tu lista de precios

La lista 2025 (aluminio, vidrio y herrajes) ya está transcrita en `data/lista-precios-2025.csv` (924 productos).
Para cargarla en tu base:

```bash
npm run import:products -- data/lista-precios-2025.csv            # vista previa
npm run import:products -- data/lista-precios-2025.csv --apply    # guardar
```

Agrega `--replace` para dar de baja (sin borrar) los productos activos que no vengan en el CSV (por ejemplo, los de ejemplo del `seed --demo`).
También se puede subir desde la app: *Productos y precios → Importar lista*.

### Formato del CSV

```
codigo,nombre,grupo,categoria,linea,color,tipo,unidad,precio,precio_metro,tiras,tramo_minimo_m,precio_m2,precio_m2_vidriero,hojas,notas
HE-001-BLA,Acrilastic Blanco,Acrilastic,Selladores,,Blanco,pieza,pza,58,,,,,,,
AL-036-NEG,"Cabezal 2"" Negro","Cabezal 2""",Aluminio,"Línea 2""",Negro,perfil,tira,,66,6.10:346,0.5,,,,
VI-001,Cristal claro 6 mm,,Vidrio,,,vidrio,hoja,,,,,650,450,1.80x2.60:1380|2.30x2.60:1795|3.60x2.60:2760,
```

- `grupo`: mismo texto en todas las variantes de color; el mostrador las junta en una tarjeta y el vendedor elige el color.
- `tiras`: `largo:precio` separados por `|` (metros). `precio_metro` vacío = solo se vende por tira.
- `precio_m2` es para cliente **particular** y `precio_m2_vidriero` para **vidriero** (el vendedor elige el tipo de cliente en el mostrador).
- `hojas`: `basexaltura:precio` separados por `|` (metros).
- Cada producto se reconoce por `codigo`: si ya existe se actualiza, si no se crea. Lo más cómodo para actualizar
  precios: *Descargar CSV* → editar en Excel → *Importar lista*.

## Estructura

```
src/
  app/(app)/        páginas con menú: tablero, mostrador, cotizaciones, ventas, productos, usuarios, ajustes
  app/(print)/      nota imprimible
  app/api/          rutas de API (auth, productos, ventas, usuarios, ajustes)
  components/       UI (mostrador, formularios, gráficas)
  lib/pricing.ts    reglas de precios (tira, tramo, m², comisión) — probadas en tests/
  lib/models/       esquemas de Mongoose
  lib/roles.ts      permisos por rol
scripts/            seed e importación por CSV
```
