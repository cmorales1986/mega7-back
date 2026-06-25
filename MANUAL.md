# Manual de Usuario — Mega7 ERP

**Versión:** 2.0  
**Fecha:** 25/06/2026  
**Stack:** Next.js (Vercel) + .NET 8 API (Railway) + PostgreSQL (Neon)  
**Contacto:** christtian.morales@gmail.com

---

## Índice

1. [Acceso al sistema](#1-acceso-al-sistema)
2. [Dashboard](#2-dashboard)
3. [Períodos Contables](#3-períodos-contables)
4. [Socios de Negocio](#4-socios-de-negocio)
5. [Productos y Catálogo](#5-productos-y-catálogo)
6. [Inventario](#6-inventario)
7. [Ventas](#7-ventas)
8. [Compras](#8-compras)
9. [Finanzas](#9-finanzas)
10. [Contabilidad](#10-contabilidad)
11. [Panel de Reportes](#11-panel-de-reportes)
12. [Configuración del Sistema](#12-configuración-del-sistema)
13. [Gestión de Permisos](#13-gestión-de-permisos)
14. [Administración de Usuarios](#14-administración-de-usuarios)
15. [Reglas Generales del Sistema](#15-reglas-generales-del-sistema)
16. [Apéndice Técnico](#16-apéndice-técnico)

---

## 1. Acceso al Sistema

### 1.1 Inicio de sesión

Al ingresar a la URL del sistema, se muestra la pantalla de login.

**Pasos para iniciar sesión:**
1. Ingresar el **nombre de usuario** (no el correo electrónico, sino el alias asignado).
2. Ingresar la **contraseña**.
3. Hacer clic en **"Ingresar"** o presionar `Enter`.

El sistema valida las credenciales contra la base de datos. Si son correctas, genera un token JWT que se almacena en una cookie segura `HttpOnly`; el usuario es redirigido automáticamente al Dashboard.

**Credenciales iniciales del sistema:**
- Usuario: `admin`
- Contraseña: `admin123`

> **Importante:** cambiar la contraseña del administrador inmediatamente después del primer ingreso. Las credenciales por defecto son solo para el primer acceso.

### 1.2 Mantenimiento de sesión

El sistema utiliza dos tokens:
- **Access Token (JWT):** token de corta duración que autoriza cada petición a la API.
- **Refresh Token:** token de larga duración almacenado en cookie segura que renueva el Access Token automáticamente en segundo plano.

El usuario permanece logueado mientras el Refresh Token sea válido. No es necesario volver a ingresar usuario y contraseña mientras la sesión esté activa.

### 1.3 Cambio de contraseña obligatorio

Si un administrador activa el flag **"Debe cambiar contraseña"** en un usuario, al iniciar sesión el sistema lo redirige automáticamente a la pantalla de cambio de contraseña antes de permitir el acceso. El usuario no puede omitir este paso.

**Pasos:**
1. Ingresar la contraseña actual.
2. Ingresar la nueva contraseña.
3. Confirmar la nueva contraseña.
4. Guardar. El sistema actualiza la contraseña y desactiva el flag.

### 1.4 Cierre de sesión

Hacer clic en el ícono de usuario (esquina superior derecha) → **"Cerrar sesión"**. El sistema invalida los tokens y redirige al login.

---

## 2. Dashboard

La pantalla principal del sistema muestra los indicadores clave del negocio calculados en tiempo real.

### 2.1 Indicadores disponibles

| Indicador | Descripción |
|---|---|
| **Total CxC (AR)** | Suma de todos los saldos pendientes de facturas de clientes activas (estado OPEN o PARTIAL) |
| **Total CxP (AP)** | Suma de todos los saldos pendientes de facturas de proveedores activas |
| **Clientes vencidos** | Número de clientes que tienen al menos una CxC cuya fecha de vencimiento ya pasó y aún tiene saldo |
| **Ventas del mes** | Total facturado (suma de `Total` de ARInvoices) en el mes calendario actual |

### 2.2 Navegación

Desde el Dashboard se puede acceder a cualquier módulo del sistema usando el menú lateral izquierdo. El menú está organizado en secciones:

- **Finanzas:** Cajas, Períodos Contables
- **Bancos y Tesorería:** Bancos, Depósitos
- **Compras:** Órdenes, Recepciones, Facturas de Servicios, Facturas por Estado
- **Ventas:** Órdenes, Facturas/Entrega, Facturas por Estado
- **Pagos:** Recibidos, Realizados
- **Movimientos:** Entradas, Salidas, Transferencias de Stock
- **Contabilidad:** Plan de Cuentas, Libro Diario, Config. Contable, Reportes
- **Datos Maestros:** Parámetros, Inventario, Socios de Negocio
- **Administración:** Usuarios, Permisos (solo ADMIN)

---

## 3. Períodos Contables

Los períodos contables son el control temporal del sistema. **Ninguna operación financiera o de inventario puede registrarse en una fecha que no esté cubierta por un período activo y abierto.**

### 3.1 ¿Qué es un período?

Un período representa un mes del año contable. Tiene una fecha de inicio (primer día del mes) y una fecha de fin (último día del mes). El sistema valida que toda fecha ingresada en documentos (facturas, cobros, pagos, movimientos de stock) caiga dentro de algún período activo y abierto.

### 3.2 Campos del período

| Campo | Descripción |
|---|---|
| **Año** | Año del período (ej: 2026) |
| **Mes** | Mes en número (1=Enero … 12=Diciembre) |
| **Desde** | Calculado automáticamente: primer día del mes |
| **Hasta** | Calculado automáticamente: último día del mes |
| **Estado** | `Abierto` → acepta operaciones; `Cerrado` → bloqueado |
| **Activo** | `true` = visible y considerado; `false` = ignorado (soft delete) |

### 3.3 Crear un nuevo período

1. Ir a **Finanzas → Períodos Contables**.
2. Hacer clic en **"Nuevo Período"**.
3. Ingresar el **Año** (ej: 2026) y el **Mes** (ej: 7 para julio).
4. El sistema calcula automáticamente las fechas de inicio y fin.
5. Hacer clic en **"Guardar"**.
6. El período queda creado en estado **Abierto**.

> El sistema no permite crear dos períodos para el mismo mes y año.

### 3.4 Cerrar un período

Al cerrar un período se bloquean todas las operaciones con fechas dentro de ese rango.

1. Localizar el período en la lista.
2. Hacer clic en el botón **"Cerrar"**.
3. Confirmar la acción. El estado cambia a `Cerrado`.

> **Efecto:** cualquier intento de registrar o modificar un documento con fecha dentro del período cerrado será rechazado con el mensaje: *"No existe un período abierto para la fecha indicada"*.

### 3.5 Reabrir un período

Si se necesita registrar operaciones en un período que fue cerrado (corrección, ajuste):

1. Localizar el período cerrado.
2. Hacer clic en **"Reabrir"**.
3. Confirmar. El estado vuelve a `Abierto`.

> Solo usuarios con permiso `Periods.Open` pueden reabrir períodos.

### 3.6 Desactivar un período

La desactivación es un soft delete: el período deja de ser visible en listas y el sistema lo ignora al validar fechas.

1. Localizar el período.
2. Hacer clic en **"Desactivar"**.

> Un período desactivado ya no cubre sus fechas: las operaciones con esas fechas serán rechazadas como si el período no existiera.

### 3.7 Flujo recomendado de períodos

```
Inicio de mes → Crear período del mes → Abierto (operaciones habituales)
Final del mes → Revisar pendientes → Cerrar período → Archivar
Si hay ajuste → Reabrir → Corregir → Volver a cerrar
```

---

## 4. Socios de Negocio

La base de socios de negocio centraliza la información de clientes y proveedores en un único catálogo. Un mismo registro puede ser simultáneamente cliente y proveedor.

### 4.1 Tipos de socios

| Tipo | Uso |
|---|---|
| **CLIENTE** | Aparece en ventas, CxC, cobros |
| **PROVEEDOR** | Aparece en compras, CxP, pagos |
| **CLIENTE + PROVEEDOR** | Registro dual; aparece en ambos módulos |

### 4.2 Datos del socio

| Campo | Descripción |
|---|---|
| **Razón Social** | Nombre legal o comercial completo |
| **Nombre Corto** | Nombre abreviado para listas y búsquedas rápidas |
| **RUC / Cédula** | Número de identificación fiscal |
| **Tipo** | CLIENTE, PROVEEDOR o ambos |
| **Condición de Crédito** | Plazo de pago por defecto (contado, 30 días, etc.) |
| **Email** | Correo de contacto o facturación |
| **Teléfono** | Número de contacto |
| **Dirección** | Dirección legal o comercial |
| **Activo** | Si está inactivo, no aparece en selectores de nuevos documentos |

### 4.3 Crear un nuevo socio

1. Ir a **Datos Maestros → Socios de Negocio → Clientes** (o Proveedores).
2. Hacer clic en **"Nuevo"**.
3. Completar los campos obligatorios: Razón Social, RUC/Cédula, Tipo.
4. Seleccionar la Condición de Crédito.
5. Completar los datos de contacto opcionales.
6. Guardar.

### 4.4 Sucursales

Cada socio puede tener múltiples sucursales o puntos de entrega con sus propios datos:
- Nombre de la sucursal
- Dirección
- Teléfono y email de la sucursal

Para agregar una sucursal: abrir el detalle del socio → sección **"Sucursales"** → **"Agregar sucursal"**.

### 4.5 Vista detalle del cliente

Al hacer clic en un cliente de la lista, se muestra la pantalla de detalle con:
- **Datos generales** del cliente.
- **Facturas pendientes:** lista de CxC con saldo abierto, ordenadas por vencimiento.
- **Cuotas:** vista consolidada de todas las cuotas pendientes de todas sus facturas.
- **Historial de cobros:** pagos registrados.

### 4.6 Cuotero de clientes

El cuotero es una vista especial que muestra **todos los vencimientos de cuotas** de todos los clientes en un solo lugar, ordenados por fecha de vencimiento. Permite identificar rápidamente qué cobros están próximos a vencer o ya vencidos.

Acceso: **Datos Maestros → Socios de Negocio → Cuotero Clientes**.

---

## 5. Productos y Catálogo

### 5.1 Productos

El catálogo de productos es el maestro de todos los artículos que el negocio compra y vende.

#### Campos del producto

| Campo | Descripción |
|---|---|
| **Nombre** | Descripción completa del producto |
| **Código** | Código interno o SKU (debe ser único) |
| **Código de Barras** | Código EAN/UPC si aplica |
| **Categoría** | Clasificación principal del producto |
| **Subcategoría** | Clasificación secundaria dentro de la categoría |
| **Marca** | Fabricante o marca comercial |
| **Unidad de Medida** | UND, KG, LT, MT, etc. |
| **Impuesto** | Tasa de IVA aplicada al producto (0%, 5%, 10%) |
| **Precio de Costo** | Precio de compra o costo de producción |
| **Precio de Venta** | Precio de venta al público |
| **Usa Lotes** | Activa el control por número de lote |
| **Usa Seriales** | Activa el control por número de serie individual |
| **Activo** | Soft delete; los productos inactivos no aparecen en nuevos documentos |

#### Crear un nuevo producto

1. Ir a **Datos Maestros → Inventario → Productos**.
2. Hacer clic en **"Nuevo Producto"**.
3. Completar Nombre, Código, Categoría y Unidad de Medida (obligatorios).
4. Seleccionar el Impuesto correspondiente.
5. Ingresar precios de costo y venta.
6. Si el producto requiere trazabilidad por lote o serie, activar el checkbox correspondiente.
7. Guardar.

### 5.2 Categorías

Las categorías son la clasificación principal de productos. **Las categorías tienen un rol central en la contabilidad automática:** cada categoría puede tener cuentas contables asociadas que determinan a qué cuenta se registran las ventas, costos e inventario de sus productos.

| Campo | Descripción |
|---|---|
| **Nombre** | Nombre de la categoría (ej: "Electrónica", "Alimentos") |
| **Código** | Código corto de identificación |
| **Cuenta de Ingresos** | Cuenta contable de ventas para esta categoría |
| **Cuenta de Costo (COGS)** | Cuenta de costo de ventas |
| **Cuenta de Inventario** | Cuenta de activo inventario |
| **Cuenta de Compras** | Cuenta de compras |

> Las cuentas de categorías se configuran en el módulo de **Configuración Contable** (ver sección 10.4).

### 5.3 Subcategorías

Segunda clasificación dentro de una categoría. Cada subcategoría pertenece a una categoría padre. Se usan principalmente para búsquedas y filtros más específicos.

### 5.4 Marcas

Catálogo de fabricantes y marcas comerciales. Cada producto puede asociarse a una marca. Se usan para filtros en reportes de inventario y ventas.

### 5.5 Unidades de Medida

Define las unidades disponibles para los productos. Ejemplos comunes: `UND` (unidades), `KG` (kilogramos), `LT` (litros), `MT` (metros), `CJA` (cajas), `PK` (pack).

Para agregar una nueva unidad: **Datos Maestros → Inventario → Unidades → Nueva Unidad**.

### 5.6 Impuestos

Catálogo de tasas de IVA aplicables a los productos. Cada impuesto tiene:
- **Nombre:** ej. "IVA 10%", "IVA 5%", "Exento"
- **Tasa:** porcentaje (ej: 10.00, 5.00, 0.00)
- **Cuenta de ventas:** cuenta contable donde se registra el IVA cobrado (débito fiscal)
- **Cuenta de compras:** cuenta contable donde se registra el IVA soportado (crédito fiscal)

---

## 6. Inventario

### 6.1 Almacenes

Los almacenes representan las ubicaciones físicas donde se guarda el stock.

#### Crear un almacén
1. Ir a **Datos Maestros → Inventario → Almacenes**.
2. Hacer clic en **"Nuevo Almacén"**.
3. Ingresar: Nombre, Código, Descripción (opcional).
4. Guardar.

> Siempre debe existir al menos un almacén activo para poder registrar movimientos de inventario.

### 6.2 Stock Actual

Vista consolidada de todas las existencias del sistema.

**Columnas:**
- Producto, Código de producto
- Categoría
- Almacén
- Cantidad disponible
- Costo unitario promedio

**Filtros disponibles:**
- Por almacén
- Por categoría
- Por texto (busca en nombre y código del producto)

> El stock se actualiza en tiempo real cada vez que se confirma una entrada, salida, transferencia, recepción de compra o factura de venta.

### 6.3 Entradas de Stock

Permiten incrementar el inventario de forma directa (ajustes de inventario, inventario inicial, devoluciones de clientes).

#### Flujo paso a paso

1. Ir a **Movimientos → Entradas**.
2. Hacer clic en **"Nueva Entrada"**.
3. Seleccionar el **Almacén** destino.
4. Ingresar la **Fecha** (debe tener período abierto).
5. Opcionalmente agregar una **Descripción** de la entrada.
6. Agregar líneas:
   - Hacer clic en **"Agregar Producto"**.
   - Buscar y seleccionar el producto.
   - Ingresar la **Cantidad**.
   - Ingresar el **Precio de Costo** unitario.
   - Si el producto usa lotes: ingresar el número de lote y fecha de vencimiento.
   - Si el producto usa seriales: ingresar el número de serie.
7. Hacer clic en **"Guardar"** para guardar en borrador.
8. Revisar la entrada.
9. Hacer clic en **"Confirmar"** para hacer efectivo el movimiento.

#### Estados de una entrada de stock

| Estado | Descripción |
|---|---|
| **Borrador** | Guardada pero no confirmada; el stock NO se actualiza aún |
| **Confirmada** | Stock actualizado; no puede modificarse |

> Una entrada confirmada no puede editarse ni eliminarse. Si hay un error, se debe crear una Salida de Stock de ajuste para compensar.

### 6.4 Salidas de Stock

Permiten decrementar el inventario de forma directa (ajustes, mermas, pérdidas, entregas sin factura).

El flujo es idéntico a las entradas pero en sentido contrario. Antes de confirmar, el sistema valida que haya suficiente stock disponible en el almacén para cada producto. Si la cantidad a retirar supera el stock disponible, la confirmación es rechazada.

### 6.5 Transferencias de Stock

Permiten mover mercadería de un almacén a otro sin que el inventario total de la empresa cambie.

#### Flujo paso a paso

1. Ir a **Movimientos → Transferencias**.
2. Hacer clic en **"Nueva Transferencia"**.
3. Seleccionar el **Almacén Origen** (de dónde sale el stock).
4. Seleccionar el **Almacén Destino** (a dónde llega el stock).
5. Ingresar la **Fecha**.
6. Agregar líneas con productos y cantidades.
7. Guardar (borrador) → Confirmar.

Al confirmar:
- El stock **disminuye** en el almacén origen.
- El stock **aumenta** en el almacén destino.
- El sistema valida disponibilidad en el origen antes de confirmar.

### 6.6 Lotes y Series (Batches)

Para productos que requieren trazabilidad individual:

**Lotes:** grupos de unidades del mismo producto con características comunes (fecha de producción, fecha de vencimiento). Ejemplo: un lote de medicamentos con vencimiento 2027-01.

**Series:** cada unidad tiene un número único. Ejemplo: equipos electrónicos con número de serie individual.

#### Gestión de lotes
1. Ir a **Datos Maestros → Inventario → Lotes / Series**.
2. Se listan todos los lotes registrados con su estado (activo, vencido, agotado).
3. Los lotes se crean automáticamente al registrar una entrada de stock con lote.

> El sistema puede configurarse para alertar sobre lotes próximos a vencer.

---

## 7. Ventas

El módulo de ventas gestiona todo el ciclo de ventas desde el pedido hasta el cobro.

```
Pedido de Venta → Factura de Venta → CxC (Cuenta por Cobrar) → Cobro
```

### 7.1 Pedidos de Venta (Sales Orders)

El pedido es un documento previo a la factura. Registra la intención de venta acordada con el cliente pero aún no genera stock ni deuda.

#### Crear un pedido de venta

1. Ir a **Ventas → Órdenes de Venta**.
2. Hacer clic en **"Nuevo Pedido"**.
3. Seleccionar el **Cliente** (el cliente debe estar activo y ser tipo CLIENTE).
4. Seleccionar el **Almacén** desde donde se despachará la mercadería.
5. Ingresar la **Fecha** del pedido.
6. Seleccionar la **Condición de Pago** (contado, crédito, etc.).
7. Agregar las líneas del pedido:
   - Seleccionar el **Producto**.
   - Ingresar la **Cantidad**.
   - El **Precio** se pre-completa con el precio de venta del producto (editable).
   - Seleccionar el **Impuesto** (se pre-completa desde el producto).
   - Ingresar el **Descuento** en porcentaje si aplica.
8. Verificar los totales: Subtotal, IVA, Total.
9. Hacer clic en **"Guardar"**.

#### Estados del pedido

| Estado | Descripción |
|---|---|
| `OPEN` | Pedido activo, pendiente de facturar |
| `INVOICED` | Factura generada a partir de este pedido |
| `CANCELLED` | Pedido cancelado |

#### Desde el pedido se puede:
- **Ver PDF** del pedido.
- **Generar Factura:** crea automáticamente una Factura de Venta precargada con todos los datos del pedido.
- **Cancelar:** anula el pedido (solo si está en estado OPEN).

### 7.2 Facturas de Venta (Sales Invoices)

La factura formaliza la venta, asigna el número fiscal y genera la Cuenta por Cobrar.

#### Crear una factura de venta

**Opción A — Desde un pedido:**
1. Abrir el pedido de venta.
2. Hacer clic en **"Generar Factura"**. El sistema crea la factura pre-cargada con los datos del pedido.
3. Revisar y ajustar si es necesario.
4. Confirmar.

**Opción B — Directamente:**
1. Ir a **Ventas → Factura/Entrega Cliente**.
2. Hacer clic en **"Nueva Factura"**.
3. Seleccionar Cliente, Almacén, Fecha, Condición de Pago.
4. Agregar líneas (igual que en el pedido).
5. Confirmar.

#### Numeración fiscal

Al confirmar, el sistema asigna automáticamente el siguiente número fiscal correlativo de la Serie de Documentos activa. El formato es:

```
Establecimiento - Punto de Expedición - Número
Ejemplo: 001-001-0000001
```

El **Timbrado** (código de autorización de la SSET) también queda registrado en la factura.

> Si no hay una Serie de Documentos Fiscales activa configurada, la factura no puede confirmarse.

#### Campos de la factura

| Campo | Descripción |
|---|---|
| **Cliente** | Socio de negocio tipo CLIENTE |
| **Almacén** | Depósito origen del stock |
| **Fecha** | Fecha de emisión (requiere período abierto) |
| **Pedido origen** | Referencia al Sales Order si aplica |
| **Condición** | Contado / Crédito |
| **Líneas** | Producto, cantidad, precio, IVA, descuento, subtotal por línea |
| **Total Exento** | Suma de líneas con IVA 0% |
| **Total Gravado 5%** | Suma de líneas con IVA 5% |
| **Total Gravado 10%** | Suma de líneas con IVA 10% |
| **IVA 5%** | Impuesto calculado sobre gravado 5% |
| **IVA 10%** | Impuesto calculado sobre gravado 10% |
| **Total** | Suma total de la factura |

#### Al confirmar la factura

1. Se descuenta el stock del almacén (las líneas de productos salen del inventario).
2. Se genera automáticamente una **CxC (AR Invoice)** con el saldo total de la factura.
3. Se asigna el número fiscal correlativo.
4. Se genera el asiento contable automático (si la contabilidad está configurada).

#### PDF de factura

El botón **"Imprimir PDF"** genera el documento oficial con:
- Logo y datos de la empresa emisora
- Datos del cliente
- Número de factura, timbrado y fecha
- Líneas de detalle con precios, cantidades e IVA
- Totales desglosados por tasa de IVA
- Pie de página con la leyenda fiscal

### 7.3 Facturas por Estado (AR Invoices — CxC)

Vista de todas las facturas emitidas filtradas por estado. Permite gestionar el cobro de las facturas.

**Estados disponibles:**
| Estado | Significado |
|---|---|
| `OPEN` | Pendiente de cobro total |
| `PARTIAL` | Cobro parcial registrado, queda saldo |
| `PAID` | Cobrada en su totalidad |
| `CANCELLED` | Anulada |

#### Generar cuotas (plan de pago diferido)

Si el cliente paga en cuotas:
1. Abrir la CxC.
2. Hacer clic en **"Generar Cuotas"**.
3. Ingresar el número de cuotas.
4. Seleccionar el esquema:
   - **INTERVAL:** separación en días entre cuotas (ej: cada 30 días).
   - **DAY_OF_MONTH:** todas las cuotas caen en un día fijo del mes (ej: el día 15 de cada mes).
5. Ingresar la fecha de la primera cuota.
6. El sistema calcula automáticamente las fechas y montos de cada cuota.
7. La última cuota ajusta el centavo para que la suma sea exacta al total.
8. Guardar.

#### Cobrar una CxC

Ver sección **7.4 Cobros**.

#### Cancelar una CxC

Solo puede cancelarse si no tiene cobros registrados.
1. Abrir la CxC en estado OPEN.
2. Hacer clic en **"Cancelar"**.
3. Confirmar la acción.

#### Reabrir una CxC cancelada

Si se canceló por error:
1. Abrir la CxC en estado CANCELLED.
2. Hacer clic en **"Reabrir"**.
3. La CxC vuelve al estado OPEN con el saldo original.

### 7.4 Cobros — Pagos Recibidos (AR Sales Receipts)

Un cobro registra el dinero recibido de un cliente y lo aplica contra una o más CxC.

#### Registrar un cobro

1. Ir a **Pagos → Recibidos** o abrir la CxC directamente y hacer clic en **"Cobrar"**.
2. Seleccionar el **Cliente**.
3. Ingresar la **Fecha de cobro** (debe tener período abierto).
4. Ingresar el **Monto recibido**.
5. Seleccionar el **Método de pago** (Efectivo, Transferencia, Cheque, Tarjeta, etc.).
6. Seleccionar **Caja o Banco** destino del dinero.
7. En la sección **"Aplicar a facturas"**, seleccionar qué CxC(s) se están pagando y qué monto se aplica a cada una.
8. Verificar que el total aplicado coincida con el monto recibido.
9. Hacer clic en **"Guardar"**.

#### Efecto del cobro

- El saldo de cada CxC disminuye en el monto aplicado.
- Si el saldo de la CxC llega a cero → estado `PAID`.
- Si queda saldo → estado `PARTIAL`.
- Se genera el asiento contable automático (si la contabilidad está configurada):
  - **DEBE** Caja/Banco = monto recibido
  - **HABER** Cuentas por Cobrar = monto recibido

---

## 8. Compras

El módulo de compras gestiona el ciclo completo de aprovisionamiento.

```
Orden de Compra → Recepción → Factura de Compra (CxP) → Pago
```

### 8.1 Órdenes de Compra (Purchase Orders)

Documento que formaliza el pedido al proveedor. No mueve stock ni genera deuda.

#### Crear una orden de compra

1. Ir a **Compras → Órdenes de Compra**.
2. Hacer clic en **"Nueva Orden"**.
3. Seleccionar el **Proveedor**.
4. Seleccionar el **Almacén destino** donde se recibirá la mercadería.
5. Ingresar la **Fecha** y la **Fecha de entrega esperada** (opcional).
6. Agregar líneas: Producto, Cantidad, Precio de costo.
7. Guardar.

#### Estados de la orden

| Estado | Descripción |
|---|---|
| `OPEN` | Orden enviada al proveedor, en espera de recepción |
| `RECEIVED` | Mercadería recibida (recepción confirmada) |
| `CANCELLED` | Orden cancelada |

### 8.2 Recepciones de Compra (Purchase Receipts)

Confirma que la mercadería llegó físicamente al almacén. Incrementa el stock.

#### Crear una recepción

**Opción A — Desde una orden de compra:**
1. Abrir la orden de compra.
2. Hacer clic en **"Crear Recepción"**. El sistema pre-carga el proveedor, almacén y productos de la orden.
3. Ajustar cantidades recibidas si difieren de lo ordenado.
4. Ingresar fecha de recepción.
5. Si hay lotes: ingresar número de lote y vencimiento por línea.
6. Confirmar.

**Opción B — Recepción directa sin orden:**
1. Ir a **Compras → Recepciones**.
2. Hacer clic en **"Nueva Recepción"**.
3. Seleccionar Proveedor, Almacén, Fecha.
4. Agregar líneas manualmente.
5. Confirmar.

#### Al confirmar la recepción

1. El stock aumenta en el almacén destino.
2. Se crea automáticamente la **Factura de Compra (CxP/AP Invoice)** correspondiente.
3. Se genera el asiento contable automático si la contabilidad está configurada:
   - **DEBE** Inventario/Compras = monto total
   - **HABER** Cuentas por Pagar = monto total

### 8.3 Facturas de Compra de Servicios (AP Invoices — Servicios)

Para registrar facturas de proveedores de servicios (honorarios, electricidad, alquiler, etc.) que no generan movimiento de inventario.

1. Ir a **Compras → Factura Servicios**.
2. Hacer clic en **"Nueva Factura de Servicio"**.
3. Seleccionar el **Proveedor**.
4. Ingresar el **Número de factura** del proveedor, **Fecha** y **Monto total**.
5. Seleccionar la condición de crédito.
6. Guardar / Confirmar.

Al confirmar:
- Se genera la CxP con el monto de la factura.
- Asiento contable: **DEBE** Gastos/Servicios, **HABER** Cuentas por Pagar.

### 8.4 Facturas de Compra por Estado (AP Invoices)

Vista consolidada de todas las facturas de proveedores filtradas por estado. Funciona igual que las CxC pero para cuentas por pagar.

- **Generar cuotas:** mismo mecanismo que las CxC (ver 7.3).
- **Cancelar:** solo si no tiene pagos registrados.

### 8.5 Pagos a Proveedores (AP Payments)

Registra el pago realizado a un proveedor contra una o más CxP.

#### Registrar un pago a proveedor

1. Ir a **Pagos → Realizados**.
2. Hacer clic en **"Nuevo Pago"**.
3. Seleccionar el **Proveedor**.
4. Ingresar la **Fecha del pago** (período abierto requerido).
5. Ingresar el **Monto pagado**.
6. Seleccionar el **Método de pago** (Efectivo, Transferencia, Cheque, etc.).
7. Seleccionar la **Caja o Banco** de origen del dinero.
8. En **"Aplicar a facturas"**, seleccionar qué CxP se está pagando y el monto aplicado.
9. Ingresar **Referencia** (número de transferencia, cheque, etc.) opcional.
10. Guardar.

#### Asiento contable generado automáticamente
- **DEBE** Cuentas por Pagar = monto pagado
- **HABER** Caja/Banco = monto pagado

---

## 9. Finanzas

### 9.1 Cajas (Cash Boxes)

Las cajas representan el efectivo físico disponible en el negocio.

#### Crear una caja
1. Ir a **Finanzas → Manejo Cajas**.
2. Hacer clic en **"Nueva Caja"**.
3. Ingresar Nombre (ej: "Caja Principal", "Caja Sucursal Norte").
4. Asignar la **Cuenta Contable** correspondiente (cuenta de activo corriente de caja).
5. Activar la caja.
6. Guardar.

> **Importante:** para que la contabilidad automática funcione, cada caja debe tener una cuenta contable asociada (ver sección 10.4).

#### Saldo de caja

El saldo de cada caja se calcula automáticamente a partir de todos los movimientos registrados:
- Suman: cobros de clientes en efectivo, depósitos entrantes.
- Restan: pagos a proveedores en efectivo, depósitos bancarios.

### 9.2 Bancos y Cuentas Bancarias

#### Crear un banco
1. Ir a **Bancos y Tesorería → Bancos**.
2. Hacer clic en **"Nuevo Banco"**.
3. Ingresar Nombre del banco.
4. Agregar las cuentas bancarias de la empresa:
   - **Alias:** nombre descriptivo de la cuenta (ej: "Cuenta Corriente BCP").
   - **Número de cuenta.**
   - **Moneda:** PYG, USD, etc.
   - **Cuenta contable:** cuenta del Plan de Cuentas asociada.
5. Guardar.

> Al igual que las cajas, cada cuenta bancaria debe tener una cuenta contable para generar asientos automáticos.

### 9.3 Depósitos Bancarios

Registra el traslado de efectivo de caja a una cuenta bancaria.

1. Ir a **Bancos y Tesorería → Depósitos**.
2. Hacer clic en **"Nuevo Depósito"**.
3. Seleccionar la **Caja** de origen.
4. Seleccionar la **Cuenta Bancaria** destino.
5. Ingresar la **Fecha**, el **Monto** y la **Referencia** (boleta de depósito).
6. Guardar.

### 9.4 Vista de Pagos Realizados

Ir a **Pagos → Realizados**.  
Lista consolidada de todos los pagos salientes (a proveedores) con:
- Filtro por rango de fechas
- Filtro por proveedor
- Filtro por estado
- Total del período visible

### 9.5 Vista de Pagos Recibidos

Ir a **Pagos → Recibidos**.  
Lista consolidada de todos los cobros entrantes (de clientes) con los mismos filtros.

### 9.6 Conceptos de Pago

Catálogo de categorías para clasificar ingresos y egresos:
- Ejemplos: "Gastos administrativos", "Comisiones de venta", "Alquiler local".
- Se usan para etiquetar movimientos que no son facturas directas.

Ir a **Configuración → Conceptos de Pagos** para gestionar el catálogo.

---

## 10. Contabilidad

El módulo de contabilidad de Mega7 genera asientos automáticos al confirmar documentos operativos y proporciona los reportes financieros fundamentales. No requiere intervención manual para las operaciones del día a día; la contabilidad se construye automáticamente a medida que el negocio opera.

### 10.1 Plan de Cuentas

El Plan de Cuentas es la estructura jerárquica de todas las cuentas contables del negocio. Se estructura en niveles donde las cuentas de mayor nivel son **títulos** (agrupadores) y las cuentas de nivel inferior son **cuentas de movimiento** (imputables).

#### Tipos de cuentas

| Tipo | Naturaleza | Descripción |
|---|---|---|
| **Activo** | Deudora | Bienes y derechos de la empresa (caja, bancos, inventario, CxC) |
| **Pasivo** | Acreedora | Obligaciones y deudas (CxP, préstamos, IVA por pagar) |
| **Patrimonio** | Acreedora | Capital, reservas y resultados acumulados |
| **Ingresos** | Acreedora | Ventas y otros ingresos operativos |
| **Costos** | Deudora | Costo de las mercaderías vendidas |
| **Gastos** | Deudora | Gastos operativos y administrativos |

#### Naturaleza de las cuentas

- **Deudora (Debit):** el saldo normal de la cuenta está en el DEBE. Aumenta con débitos, disminuye con créditos. (Activos, Costos, Gastos)
- **Acreedora (Credit):** el saldo normal está en el HABER. Aumenta con créditos, disminuye con débitos. (Pasivos, Patrimonio, Ingresos)

#### Cuentas Título vs. Cuentas de Movimiento

- **Título (IsTitle = true):** cuenta agrupadora. Solo sirve para organizar el plan. **No puede recibir asientos.**
- **Movimiento (IsTitle = false):** cuenta imputable. Los asientos contables se registran en estas cuentas.

#### Ver el Plan de Cuentas

1. Ir a **Contabilidad → Plan de Cuentas**.
2. Se muestra el árbol completo de cuentas organizado jerárquicamente.
3. Hacer clic en cualquier cuenta título para expandir/contraer sus subcuentas.
4. El tipo y naturaleza de cada cuenta se muestran en etiquetas de colores.

#### Crear una nueva cuenta

1. En el Plan de Cuentas, hacer clic en **"Nueva Cuenta"**.
2. Ingresar:
   - **Código:** código único de la cuenta (ej: `1.1.01.001`). Se almacena en mayúsculas.
   - **Nombre:** descripción de la cuenta. Se almacena en mayúsculas.
   - **Tipo:** Activo, Pasivo, Patrimonio, Ingresos, Costos o Gastos.
   - **Naturaleza:** Deudora o Acreedora (se pre-selecciona según el tipo).
   - **¿Es título?:** marcar si es una cuenta agrupadora.
   - **Cuenta padre:** seleccionar la cuenta título bajo la que se agrupará.
   - **Nivel:** nivel en la jerarquía (1=raíz, 2=segundo nivel, etc.).
3. Guardar.

> Solo ADMIN y SUPERVISOR pueden crear cuentas. Solo ADMIN puede eliminarlas.

#### Reglas al crear cuentas

- El código debe ser **único** en todo el plan.
- Solo se pueden agregar subcuentas bajo una **cuenta título**.
- No se puede convertir una cuenta título en cuenta de movimiento si tiene subcuentas.
- No se puede eliminar una cuenta que tiene subcuentas o asientos registrados.

#### Editar una cuenta

Hacer clic en el ícono de edición junto a la cuenta. Se pueden modificar todos los campos excepto que no se puede quitar el flag "Es título" si la cuenta tiene hijos.

### 10.2 Libro Diario

El Libro Diario muestra todos los asientos contables del sistema en orden cronológico.

#### Acceder al Libro Diario

Ir a **Contabilidad → Libro Diario**.

#### Información de cada asiento

| Campo | Descripción |
|---|---|
| **N° Asiento** | Número correlativo del asiento |
| **Fecha** | Fecha del asiento |
| **Descripción** | Descripción del asiento (ej: "Factura de Venta 001-001-0000001") |
| **Referencia** | Referencia al documento origen (número de factura, recibo, etc.) |
| **Origen** | Tipo de operación que generó el asiento (Venta, Compra, Cobro, Pago, Manual) |
| **Estado** | Borrador o Contabilizado |
| **Total** | Suma del DEBE (y HABER, que siempre debe ser igual) |

#### Ver el detalle de un asiento

Hacer clic en cualquier asiento para ver sus líneas:
- Cuenta (código y nombre)
- DEBE
- HABER
- Descripción de la línea

#### Crear un asiento manual

Para registrar operaciones que no tienen documento automático (ajustes, depreciaciones, correcciones):

1. En el Libro Diario, hacer clic en **"Nuevo Asiento"**.
2. Seleccionar la **Fecha** (período abierto requerido).
3. Ingresar la **Descripción** del asiento.
4. Ingresar una **Referencia** opcional.
5. Agregar las líneas del asiento:
   - Seleccionar la **Cuenta** (solo cuentas de movimiento, no títulos).
   - Ingresar el monto en **DEBE** o **HABER** (nunca ambos en la misma línea).
   - Descripción de la línea (opcional).
6. El sistema muestra en tiempo real si el asiento está **cuadrado** (DEBE = HABER) o desbalanceado.
7. Un asiento solo puede guardarse si está perfectamente cuadrado.
8. Hacer clic en **"Guardar"**.

> **Regla fundamental de contabilidad:** todo asiento debe cuadrar. La suma del DEBE debe ser igual a la suma del HABER. El sistema rechaza cualquier asiento que no cumpla esta condición.

#### Filtros del Libro Diario

- **Por fecha:** desde/hasta
- **Por origen:** Venta, Compra, Cobro, Pago, Manual, Banco, Caja
- **Por descripción:** búsqueda de texto libre

### 10.3 Contabilidad Automática

Mega7 genera asientos contables automáticamente cuando se confirman documentos operativos. Este proceso es **transparente al usuario** — no requiere ninguna acción adicional.

#### Documentos que generan asientos automáticos

| Documento | Evento | Asiento generado |
|---|---|---|
| Factura de Venta | Al confirmar | DEBE CxC = Total; HABER Ventas por línea; HABER IVA Débito Fiscal |
| Cobro de Cliente | Al guardar | DEBE Caja/Banco = Monto; HABER CxC = Monto |
| Factura de Compra | Al confirmar recepción o servicio | DEBE Inventario/Gastos = Total; HABER CxP = Total |
| Pago a Proveedor | Al guardar | DEBE CxP = Monto; HABER Caja/Banco = Monto |

#### Detalle del asiento de venta

Al confirmar una Factura de Venta:

```
DEBE   Clientes (AR_CLIENTES)          = Total de la factura
HABER  Ventas Gravadas / Exentas       = Subtotal por línea (agrupado por cuenta de categoría)
HABER  IVA Débito Fiscal               = Impuesto por línea (agrupado por cuenta de impuesto)
```

La cuenta de ventas se determina en este orden de prioridad:
1. Si la categoría del producto tiene una **Cuenta de Ingresos** configurada → usa esa cuenta.
2. Si no, según si la línea tiene IVA:
   - Con IVA > 0 → usa la cuenta global `VENTAS_GRAVADAS`
   - Sin IVA → usa la cuenta global `VENTAS_EXENTAS`

#### Detalle del asiento de cobro

```
DEBE   Caja o Banco                    = Monto cobrado
HABER  Clientes (AR_CLIENTES)          = Monto cobrado
```

La cuenta de Caja o Banco se determina según el método de pago:
- **Efectivo (CASH):** se usa la cuenta contable de la primera caja activa que tenga cuenta contable asignada.
- **Otro método (Transferencia, Cheque, etc.):** se usa la cuenta contable del primer banco activo.

#### Idempotencia de los asientos

El sistema es **idempotente**: si por algún error el proceso de contabilización se ejecuta dos veces para el mismo documento, el segundo intento detecta que ya existe un asiento para esa fuente y lo omite silenciosamente. Nunca se generan asientos duplicados.

#### ¿Qué ocurre si la contabilidad no está configurada?

Si las cuentas contables no están asignadas en la Configuración Contable, el proceso de generación de asientos **falla silenciosamente** — no interrumpe la operación del negocio. La factura se confirma, el stock se mueve, la CxC se genera, pero no se crea el asiento contable. Esto permite usar el sistema operativamente antes de terminar de configurar la contabilidad.

### 10.4 Configuración Contable

La configuración contable conecta las cuentas del Plan de Cuentas con los procesos del negocio. Solo ADMIN y SUPERVISOR pueden modificarla.

Ir a **Contabilidad → Config. Contable**.

#### Sección 1: Cuentas Globales

Son las cuentas que el sistema usa de forma genérica para todas las operaciones.

| Clave | Descripción | Tipo de cuenta esperado |
|---|---|---|
| **AR_CLIENTES** | Cuentas por Cobrar Clientes | Activo — Deudora |
| **AP_PROVEEDORES** | Cuentas por Pagar Proveedores | Pasivo — Acreedora |
| **VENTAS_GRAVADAS** | Ingresos por ventas con IVA | Ingresos — Acreedora |
| **VENTAS_EXENTAS** | Ingresos por ventas exentas | Ingresos — Acreedora |
| **INVENTARIO_MERCANCIAS** | Inventario de mercaderías | Activo — Deudora |
| **COMPRAS_SERVICIOS** | Compras de servicios | Gastos — Deudora |
| **GASTOS_GENERALES** | Gastos generales (fallback) | Gastos — Deudora |

**Para asignar una cuenta global:**
1. En la sección "Cuentas Globales", localizar la clave (ej: AR_CLIENTES).
2. Hacer clic en el selector de cuenta.
3. Buscar y seleccionar la cuenta correspondiente del Plan de Cuentas.
4. La cuenta debe ser una **cuenta de movimiento** (no título).
5. Hacer clic en **"Guardar Configuración Global"**.

#### Sección 2: Cuentas de Cajas

Cada caja registradora debe tener una cuenta contable asociada para que los cobros y pagos en efectivo se registren en la cuenta correcta.

**Para asignar:**
1. En la sección "Cajas", localizar la caja.
2. Seleccionar la cuenta contable de activo corriente correspondiente.
3. Guardar.

#### Sección 3: Cuentas de Bancos

Cada cuenta bancaria debe tener una cuenta contable del Plan de Cuentas.

**Para asignar:**
1. En la sección "Cuentas Bancarias", localizar la cuenta.
2. Seleccionar la cuenta contable correspondiente.
3. Guardar.

#### Sección 4: Cuentas por Categoría de Producto

Cada categoría de producto puede tener hasta 4 cuentas contables específicas que sobreescriben las cuentas globales para los productos de esa categoría.

| Campo | Uso |
|---|---|
| **Cuenta de Ingresos** | Ventas de productos de esta categoría |
| **Cuenta de COGS** | Costo de ventas de esta categoría |
| **Cuenta de Inventario** | Activo inventario de esta categoría |
| **Cuenta de Compras** | Compras de productos de esta categoría |

**Para configurar:**
1. En la sección "Categorías de Productos", localizar la categoría.
2. Asignar las cuentas correspondientes.
3. Guardar.

> Si una categoría no tiene cuentas asignadas, el sistema usa las cuentas globales como fallback.

#### Sección 5: Cuentas de Impuestos

Cada tasa de IVA debe tener dos cuentas:
- **Cuenta de Ventas (Débito Fiscal):** donde se acumula el IVA cobrado a clientes.
- **Cuenta de Compras (Crédito Fiscal):** donde se acumula el IVA pagado a proveedores.

**Para configurar:**
1. En la sección "Impuestos", localizar el impuesto (ej: IVA 10%).
2. Asignar la cuenta de ventas y la cuenta de compras.
3. Guardar.

### 10.5 Balance de Comprobación (Trial Balance)

El Balance de Comprobación muestra los totales acumulados de DEBE, HABER y SALDO de todas las cuentas que tuvieron movimientos en el período seleccionado. Sirve para verificar que la contabilidad esté cuadrada.

**Acceso:** Contabilidad → Bal. Comprobación (o desde el Panel de Reportes → Contabilidad).

#### Cómo usar el reporte

1. Seleccionar el rango de fechas (**Desde** y **Hasta**).
2. Hacer clic en **"Actualizar"** (o esperar que cargue automáticamente).
3. El reporte muestra las cuentas agrupadas por tipo (Activo, Pasivo, Patrimonio, Ingresos, Costos, Gastos).

#### Columnas del reporte

| Columna | Descripción |
|---|---|
| **Código** | Código de la cuenta en el Plan de Cuentas |
| **Nombre** | Nombre de la cuenta |
| **Debe** | Suma total de débitos del período |
| **Haber** | Suma total de créditos del período |
| **Saldo** | Debe − Haber (cuentas deudoras) o Haber − Debe (acreedoras) |

#### Indicador de cuadre

En la parte superior derecha aparece un chip:
- ✅ **"Asientos cuadrados"** — la suma total del DEBE iguala la suma total del HABER. La contabilidad está correcta.
- ⚠️ **"Diferencia: X"** — hay un desbalance. Indica que algún asiento no cuadra o hay un error de registro.

#### Subtotales por tipo

El reporte muestra un subtotal de DEBE, HABER y SALDO para cada grupo de cuentas (Activo, Pasivo, etc.), facilitando la verificación.

#### Imprimir

Hacer clic en **"Imprimir"** para abrir el diálogo de impresión del navegador. El reporte se adapta automáticamente para impresión (oculta botones y controles).

### 10.6 Libro Mayor (Ledger)

El Libro Mayor muestra el detalle de todos los movimientos de una cuenta específica en un período, con el saldo corrido (saldo acumulado línea por línea).

**Acceso:** Contabilidad → Libro Mayor (o Panel de Reportes → Contabilidad).

#### Cómo usar el reporte

1. Seleccionar la **Cuenta** en el selector (solo muestra cuentas de movimiento activas).
2. Seleccionar el rango de fechas (**Desde** y **Hasta**).
3. El reporte carga automáticamente.

#### Información del reporte

**Cabecera:** muestra el código, nombre, tipo y naturaleza de la cuenta seleccionada.

**Fila "Saldo inicial":** saldo acumulado de la cuenta **antes** del período seleccionado (suma de todos los asientos anteriores a la fecha "Desde").

**Filas de movimientos:**

| Columna | Descripción |
|---|---|
| **Fecha** | Fecha del asiento |
| **Asiento #** | Número del asiento contable |
| **Descripción** | Descripción del asiento y de la línea |
| **Origen** | Tipo de operación (Venta, Compra, Cobro, Pago, Manual, etc.) |
| **Debe** | Monto debitado en esta línea |
| **Haber** | Monto acreditado en esta línea |
| **Saldo** | Saldo corrido acumulado hasta esta línea |

**Pie del reporte:**
- **Totales del período:** suma de DEBE y HABER de todas las líneas del período.
- **SALDO FINAL:** saldo al cierre del período.

#### Saldo corrido

El saldo corrido se calcula sumando el saldo inicial más cada movimiento, considerando la naturaleza de la cuenta:
- Cuenta deudora: `saldo = saldo_anterior + debe − haber`
- Cuenta acreedora: `saldo = saldo_anterior + haber − debe`

Un saldo negativo se muestra en rojo, indicando que la cuenta tiene saldo contrario a su naturaleza.

### 10.7 Estado de Resultados (Income Statement)

El Estado de Resultados muestra los ingresos, costos y gastos del período y calcula la **Utilidad o Pérdida Neta**.

**Acceso:** Contabilidad → Est. Resultados (o Panel de Reportes → Contabilidad).

#### Cómo usar el reporte

1. Seleccionar el rango de fechas (**Desde** y **Hasta**). Por defecto muestra el año en curso.
2. Hacer clic en **"Actualizar"**.

#### Secciones del reporte

**1. Ingresos**  
Lista todas las cuentas de tipo `Ingresos` con movimientos en el período.
- Cada fila muestra código, nombre y monto de ingresos netos.
- Total Ingresos al pie de la sección.

**2. Costo de Ventas**  
Lista las cuentas de tipo `Costos`.
- Total Costos al pie de la sección.

**3. Utilidad Bruta**  
```
Utilidad Bruta = Total Ingresos − Total Costos
```
Se muestra en verde (positiva) o rojo (negativa).

**4. Gastos Operativos**  
Lista las cuentas de tipo `Gastos`.
- Total Gastos al pie de la sección.

**5. Utilidad Neta**  
```
Utilidad Neta = Utilidad Bruta − Total Gastos Operativos
```
Se muestra en un banner grande:
- Verde con "Utilidad Neta" si es positiva.
- Rojo con "Pérdida Neta" si es negativa.

#### Chip de resumen

En la parte superior aparece: **"Utilidad: X"** o **"Pérdida: X"** para referencia rápida.

### 10.8 Balance General (Balance Sheet)

El Balance General muestra la situación patrimonial de la empresa en un momento específico. Verifica que el **Activo = Pasivo + Patrimonio**.

**Acceso:** Contabilidad → Balance General (o Panel de Reportes → Contabilidad).

#### Cómo usar el reporte

1. Seleccionar la fecha **"Al"** (fecha de corte). Por defecto es hoy.
2. El reporte carga todos los movimientos **hasta** esa fecha (acumulativo, no por período).

#### Estructura del reporte

El reporte se divide en dos columnas:

**Columna izquierda — ACTIVO**
- Lista todas las cuentas de tipo `Activo` con su saldo acumulado.
- **Total Activo** al final.

**Columna derecha — PASIVO Y PATRIMONIO**

*Sección Pasivo:*
- Lista todas las cuentas de tipo `Pasivo`.
- **Total Pasivo** al pie.

*Sección Patrimonio:*
- Lista todas las cuentas de tipo `Patrimonio`.
- **Utilidad/Pérdida del ejercicio:** línea calculada automáticamente a partir de Ingresos − Costos − Gastos acumulados hasta la fecha de corte. Esta línea no es una cuenta del Plan de Cuentas — es la utilidad no apropiada del período.
- **Total Patrimonio** (incluye la utilidad/pérdida del ejercicio).

**Pie de la columna derecha:**
- Total Pasivo
- Total Patrimonio
- **Total Pasivo + Patrimonio** (debe igualar al Total Activo)

#### Indicador de cuadre

- ✅ **"Balance cuadrado"** — Activo = Pasivo + Patrimonio. Todo correcto.
- ⚠️ **"Descuadre: X"** — hay una diferencia. Indica asientos sin cuadrar o cuentas mal clasificadas.

---

## 11. Panel de Reportes

El Panel de Reportes es un menú contextual que da acceso rápido a los reportes del sistema desde cualquier pantalla.

### 11.1 Abrir el Panel de Reportes

Hacer clic en el ícono de reportes en la barra superior (generalmente representado con un ícono de gráfico o reportes).

El panel se abre como un cajón lateral (drawer) desde la derecha.

### 11.2 Estructura del menú

Los reportes están organizados en secciones. Las secciones incluidas por defecto son:

| Sección | Reportes disponibles |
|---|---|
| **VENTAS** | Dashboard Ejecutivo, Ventas vs. Cobros |
| **OPERACIONES** | Resumen del Día |
| **CxC — COBROS** | Aging CxC |
| **INVENTARIO** | Stock Actual |
| **CONTABILIDAD** | Bal. Comprobación, Libro Mayor, Est. Resultados, Balance General |

### 11.3 Usar un reporte del panel

Hacer clic en cualquier ítem del panel → el navegador redirige a la página del reporte correspondiente.

### 11.4 Configurar el menú de reportes (solo ADMIN)

El menú de reportes es **completamente configurable** desde la base de datos.

Ir a **Configuración → Menú de Reportes** para:
- Agregar nuevas secciones (grupos).
- Agregar nuevos ítems con URL, ícono y orden.
- Activar o desactivar secciones/ítems.
- Asignar visibilidad por rol.

---

## 12. Configuración del Sistema

### 12.1 Series de Documentos Fiscales

Define los datos de la numeración legal de facturas requerida por la SSET (Subsecretaría de Estado de Tributación).

**Acceso:** Configuración → Series Fiscales.

| Campo | Descripción |
|---|---|
| **Establecimiento** | Código del establecimiento comercial (ej: `001`) |
| **Punto de Expedición** | Código del punto de venta (ej: `001`) |
| **Número actual** | Correlativo actual. Se incrementa automáticamente en cada factura |
| **Timbrado** | Código de autorización otorgado por la SSET |
| **Vencimiento del Timbrado** | Fecha hasta la cual el timbrado es válido |
| **Activo** | Solo puede haber una serie activa a la vez |

**Crear una serie:**
1. Hacer clic en **"Nueva Serie"**.
2. Completar todos los campos.
3. Marcar como **Activa**.
4. Guardar.

> Si el timbrado vence, el sistema bloquea la emisión de nuevas facturas hasta que se configure una nueva serie con timbrado vigente.

### 12.2 Condiciones de Crédito (Credit Terms)

Catálogo de plazos de pago para asignar a socios de negocio.

**Ejemplos:** Contado (0 días), 30 días, 45 días, 60 días, 90 días.

Cada condición tiene:
- **Nombre:** descripción del plazo.
- **Días:** número de días para calcular la fecha de vencimiento.

**Crear condición:** Configuración → Condiciones de Crédito → Nueva Condición.

### 12.3 Parámetros de Venta

Configuración general del módulo de ventas:
- **Precio de venta por defecto:** qué precio se pre-carga al agregar un producto a una factura.
- **Descuento máximo:** porcentaje máximo de descuento que puede aplicarse en una línea de venta.
- **Almacén predeterminado:** almacén que se pre-selecciona al crear nuevas facturas de venta.

**Acceso:** Configuración → Ventas (Parámetros de Venta).

### 12.4 Impuestos

El catálogo de impuestos también se gestiona desde Configuración → Impuestos.

Cada impuesto tiene:
- **Nombre:** ej. "IVA 10%".
- **Tasa:** 10.00 (porcentaje).
- **Cuenta de Ventas:** para la contabilidad automática (ver sección 10.4).
- **Cuenta de Compras:** para la contabilidad automática.

### 12.5 Conceptos de Pago

Catálogo de conceptos para clasificar pagos y cobros no vinculados a facturas. Se accede desde Configuración → Conceptos de Pagos.

### 12.6 Menú de Reportes (configuración)

Gestión del árbol de reportes que aparece en el Panel de Reportes. Solo ADMIN puede modificarlo.

**Acceso:** Configuración → Menú de Reportes (desde el panel de administración).

Campos de cada ítem:
| Campo | Descripción |
|---|---|
| **Nombre** | Texto que aparece en el panel |
| **¿Es Título?** | Si está marcado, es una sección/grupo (sin URL) |
| **URL** | Ruta de la página del reporte (ej: `/accounting/reports/trial-balance`) |
| **Ícono** | Nombre del ícono de Lucide (ej: `Scale`, `BookText`, `TrendingUp`) |
| **Orden** | Posición en el menú (número entero) |
| **Padre** | Sección a la que pertenece el ítem |
| **Rol requerido** | Si se deja vacío, visible para todos los roles |
| **Activo** | Si está inactivo, no aparece en el panel |

### 12.7 Empresas (Tenants)

Datos de la empresa que usa el sistema. Se usan en documentos PDF.

| Campo | Uso |
|---|---|
| **Razón Social** | Aparece en cabecera de facturas y recibos |
| **RUC** | Identificación fiscal en PDFs |
| **Dirección** | Dirección legal en PDFs |
| **Teléfono / Email** | Datos de contacto en PDFs |
| **Logo** | Logo de la empresa en PDFs |

**Acceso:** Configuración → Empresa (Tenants).

---

## 13. Gestión de Permisos

El módulo de permisos permite controlar con precisión qué puede hacer cada rol en el sistema. Es una herramienta exclusiva para **ADMIN**.

**Acceso:** Administración → Permisos.

### 13.1 Concepto de roles y permisos

Mega7 usa un sistema combinado de **roles** y **permisos granulares**:

- **Roles:** definen un nivel general de acceso. Los roles disponibles son:
  - `ADMIN`: acceso completo a todo el sistema.
  - `SUPERVISOR`: acceso operativo ampliado.
  - `CAJERO`: acceso limitado a operaciones de caja.
  - `VENTAS`: acceso al módulo de ventas.
  - `USER` (rol interno): nivel base de operaciones.

- **Permisos:** acciones específicas dentro de cada módulo. Ejemplo: `SalesInvoices.Create` permite crear facturas de venta.

### 13.2 Pantalla de Gestión de Permisos

La pantalla muestra:
1. **Selector de rol** en la parte superior — chips con cada rol disponible.
2. **Contador de permisos** — muestra cuántos permisos están activos del total disponible (ej: "107 de 120 permisos activos").
3. **Lista de módulos** — cada módulo se muestra como una fila expandible con su contador individual.

### 13.3 Seleccionar un rol para configurar

1. Hacer clic en el chip del rol que se desea configurar (ej: CAJERO).
2. La lista se actualiza mostrando los permisos activos para ese rol.

### 13.4 Ver los permisos de un módulo

1. Hacer clic en la fila de un módulo (ej: "Ventas") para expandirla.
2. Se muestran todos los permisos disponibles dentro de ese módulo con un checkbox cada uno.
   - ✅ Marcado = el rol **puede** realizar esa acción.
   - ⬜ Desmarcado = el rol **no puede** realizar esa acción.

### 13.5 Activar o desactivar permisos

1. Hacer clic en el checkbox del permiso deseado para alternarlo.
2. Se pueden hacer múltiples cambios antes de guardar.
3. **Importante:** los cambios no se guardan automáticamente — hacer clic en **"Guardar cambios"** (botón en la parte superior o inferior de la pantalla).

### 13.6 Marcar/Desmarcar todos los permisos

Hacer clic en **"Marcar todo"** en la cabecera del listado para activar o desactivar todos los permisos del rol a la vez.

También se puede hacer clic en el checkbox del módulo (en la fila colapsada) para marcar/desmarcar todos los permisos de ese módulo de una vez.

### 13.7 Módulos y permisos disponibles

#### General
| Permiso | Descripción |
|---|---|
| Dashboard: Ver | Acceder a la pantalla principal |

#### Períodos
| Permiso | Descripción |
|---|---|
| Períodos: Ver | Ver la lista de períodos contables |
| Períodos: Crear | Crear nuevos períodos |
| Períodos: Cerrar | Cerrar un período abierto |
| Períodos: Reabrir | Reabrir un período cerrado |
| Períodos: Desactivar | Desactivar períodos |

#### Socios de Negocio
| Permiso | Descripción |
|---|---|
| Socios de Negocio: Ver | Ver clientes y proveedores |
| Socios de Negocio: Crear | Crear nuevos socios |
| Socios de Negocio: Editar | Modificar datos de socios existentes |
| Socios de Negocio: Eliminar | Eliminar (desactivar) socios |

#### Productos
| Permiso | Descripción |
|---|---|
| Productos: Ver | Ver el catálogo de productos |
| Productos: Crear | Crear nuevos productos |
| Productos: Editar | Modificar productos existentes |
| Productos: Eliminar | Desactivar productos |
| Categorías: Ver/Crear/Editar/Eliminar | Gestión de categorías de productos |
| Subcategorías: Ver/Crear/Editar/Eliminar | Gestión de subcategorías |
| Marcas: Ver/Crear/Editar/Eliminar | Gestión de marcas |
| Unidades de Medida: Ver/Crear/Editar/Eliminar | Gestión de unidades |
| Impuestos: Ver/Crear/Editar/Eliminar | Gestión de tasas de IVA |

#### Inventario
| Permiso | Descripción |
|---|---|
| Almacenes: Ver/Crear/Editar/Eliminar | Gestión de almacenes |
| Stock: Ver | Ver el stock actual |
| Entrada de Stock: Ver/Crear/Confirmar/Anular | Gestión de entradas |
| Salida de Stock: Ver/Crear/Confirmar/Anular | Gestión de salidas |
| Transferencia de Stock: Ver/Crear/Confirmar/Anular | Gestión de transferencias |
| Lotes: Ver/Crear/Editar | Gestión de lotes y series |

#### Ventas
| Permiso | Descripción |
|---|---|
| Pedidos de Venta: Ver/Crear/Editar/Cancelar | Gestión de órdenes de venta |
| Facturas de Venta: Ver/Crear/Anular/Imprimir PDF | Gestión de facturas |
| CxC: Ver/Generar Cuotas/Anular/Reabrir | Gestión de cuentas por cobrar |
| Cobros (CxC): Ver/Registrar/Anular | Gestión de cobros |
| Recibos de Cobro: Ver/Crear | Gestión de recibos |

#### Compras
| Permiso | Descripción |
|---|---|
| Órdenes de Compra: Ver/Crear/Editar/Cancelar | Gestión de órdenes |
| Recepciones de Compra: Ver/Crear/Editar/Confirmar | Gestión de recepciones |
| Facturas de Compra: Ver/Crear/Anular | Gestión de CxP |
| Pagos a Proveedores: Ver/Registrar/Anular | Gestión de pagos |

#### Finanzas
| Permiso | Descripción |
|---|---|
| Bancos: Ver/Crear/Editar | Gestión de cuentas bancarias |
| Cajas: Ver/Crear/Editar | Gestión de cajas |
| Depósitos Bancarios: Ver/Crear | Gestión de depósitos |
| Pagos Realizados: Ver | Ver pagos a proveedores |
| Pagos Recibidos: Ver | Ver cobros de clientes |
| Conceptos de Pago: Ver/Crear/Editar/Eliminar | Gestión del catálogo |

#### Contabilidad
| Permiso | Descripción |
|---|---|
| Plan de Cuentas: Ver | Ver el árbol del plan de cuentas |
| Plan de Cuentas: Crear | Crear nuevas cuentas contables |
| Plan de Cuentas: Editar | Modificar cuentas existentes |
| Libro Diario: Ver | Ver asientos contables |
| Libro Diario: Crear asiento | Registrar asientos manuales |
| Reportes Contables: Ver | Acceder a los 4 reportes contables |
| Config. Contable: Ver | Ver la configuración de cuentas |
| Config. Contable: Editar | Modificar mapeo de cuentas |

#### Reportes
| Permiso | Descripción |
|---|---|
| Reportes: Ver | Acceder al panel de reportes |

#### Configuración
| Permiso | Descripción |
|---|---|
| Series Fiscales: Ver/Crear/Editar | Gestión de timbrados y series |
| Condiciones de Crédito: Ver/Crear/Editar/Eliminar | Gestión de plazos |
| Parámetros de Venta: Ver/Editar | Configuración de ventas |
| Menú de Reportes: Ver/Crear/Editar/Eliminar | Configuración del panel |
| Empresas: Ver/Editar | Datos de la empresa |
| Notificaciones: Ver | Ver notificaciones del sistema |

#### Administración
| Permiso | Descripción |
|---|---|
| Usuarios: Ver | Ver la lista de usuarios |
| Usuarios: Crear | Crear nuevos usuarios |
| Usuarios: Editar | Modificar usuarios existentes |
| Usuarios: Desactivar | Desactivar cuentas de usuario |

### 13.8 Permisos por defecto (USER)

Al crear un nuevo usuario con rol USER, se asigna automáticamente un conjunto base de permisos que incluye:
- Ver todo (Dashboard, Períodos, Socios, Productos, Inventario, Ventas, Compras, Finanzas)
- Operaciones del día a día (crear/editar pedidos, facturas, cobros, pagos, movimientos de stock)
- Ver Contabilidad (Plan de Cuentas, Libro Diario, Reportes, Config. Contable)
- **No incluye:** administración de usuarios, configuración fiscal, eliminar registros, crear asientos manuales, editar config. contable.

---

## 14. Administración de Usuarios

Acceso: **Administración → Usuarios** (solo ADMIN).

### 14.1 Roles del sistema

| Rol | Descripción |
|---|---|
| `ADMIN` | Acceso completo. Puede gestionar usuarios, permisos y toda la configuración |
| `SUPERVISOR` | Acceso operativo ampliado. Puede crear/editar cuentas contables y config. contable |
| `CAJERO` | Acceso limitado a operaciones de caja (cobros, pagos en efectivo) |
| `VENTAS` | Acceso al módulo de ventas (pedidos, facturas, cobros) |
| `USER` | Rol operativo base. Incluye la mayoría de operaciones del día a día |

> Los permisos de cada rol son configurables desde **Administración → Permisos** (ver sección 13).

### 14.2 Crear un usuario

1. Ir a **Administración → Usuarios**.
2. Hacer clic en **"Nuevo Usuario"**.
3. Completar los campos:
   - **Nombre completo:** nombre real del empleado.
   - **Nombre de usuario:** alias único para el login (sin espacios, minúsculas).
   - **Email:** correo del usuario.
   - **Contraseña:** contraseña inicial. Se recomienda obligar el cambio en el primer acceso.
   - **Rol:** seleccionar el rol apropiado.
   - **Activo:** marcar para que el usuario pueda iniciar sesión.
4. Opcionalmente activar **"Debe cambiar contraseña"** para obligar al usuario a cambiarla en el primer acceso.
5. Guardar.

### 14.3 Editar un usuario

1. Hacer clic en el usuario en la lista.
2. Modificar los campos necesarios.
3. Guardar.

> No se puede editar el nombre de usuario (alias) de un usuario existente.

### 14.4 Activar / Desactivar un usuario

Los usuarios no se eliminan físicamente — se desactivan (soft delete).

- **Desactivar:** el usuario no puede iniciar sesión. Sus datos y operaciones históricas se conservan.
- **Activar:** el usuario puede volver a iniciar sesión.

### 14.5 Forzar cambio de contraseña

Para obligar a un usuario a cambiar su contraseña en el próximo login:
1. Abrir el usuario.
2. Activar el checkbox **"Debe cambiar contraseña"**.
3. Guardar.

En el próximo login, el sistema redirige al usuario a la pantalla de cambio de contraseña antes de dejarlo pasar.

### 14.6 Seguridad de contraseñas

- Las contraseñas se almacenan con hash seguro (bcrypt). Nadie, ni el administrador, puede ver la contraseña original.
- Si un usuario olvida su contraseña, el administrador puede establecer una nueva contraseña temporal y activar el flag de cambio obligatorio.

---

## 15. Reglas Generales del Sistema

### 15.1 Control de períodos

**Toda operación** que involucre dinero o inventario verifica que exista un período **activo y abierto** que cubra la fecha del documento. Si no existe tal período, la operación es rechazada con el mensaje:

> *"No existe un período abierto para la fecha de [fecha]"*

Módulos afectados: Ventas, Compras, Cobros, Pagos, Movimientos de Stock.

### 15.2 Soft Delete

La mayoría de los registros del sistema no se eliminan físicamente de la base de datos. En cambio, se marcan como `IsActive = false`. Esto significa:

- Los datos históricos siempre se conservan.
- Los registros inactivos no aparecen en selectores ni listas de trabajo.
- Los reportes históricos siguen siendo correctos aunque un producto, socio o cuenta sea desactivado.
- Es posible reactivar un registro que fue desactivado por error.

### 15.3 Estados de documentos financieros

Los documentos financieros (CxC, CxP) siguen un flujo de estados unidireccional:

```
OPEN ──► PARTIAL ──► PAID
OPEN ──► CANCELLED
```

- **OPEN:** saldo completo pendiente.
- **PARTIAL:** se registraron cobros/pagos pero queda saldo.
- **PAID:** completamente cobrado/pagado. Un documento PAID no puede cancelarse directamente.
- **CANCELLED:** anulado. Solo se puede cancelar un documento OPEN (sin cobros/pagos registrados).

### 15.4 Numeración fiscal

- Las facturas de venta tienen número fiscal correlativo e irrepetible dentro de cada timbrado.
- El número se asigna automáticamente y no puede modificarse manualmente.
- Si el timbrado de la serie activa está vencido, el sistema bloquea la emisión de nuevas facturas.
- Al anular una factura, el número fiscal queda marcado como anulado pero no se reutiliza.

### 15.5 Cuotas e instalamentos

- Las cuotas se aplican con lógica FIFO: cada pago se aplica primero a la cuota más antigua.
- El monto de la última cuota se ajusta automáticamente para que la suma sea exacta al centavo del total original.
- Si se registra un pago mayor al saldo de la cuota actual, el excedente se aplica a la siguiente cuota.

### 15.6 Control de stock

- El stock **nunca puede quedar negativo**. El sistema valida disponibilidad antes de confirmar salidas, transferencias y facturas de venta.
- Si se intenta confirmar una salida con más cantidad que el stock disponible, la confirmación es rechazada con el mensaje indicando qué producto no tiene stock suficiente.
- Los productos con control de **lote** requieren especificar el número de lote en cada movimiento de entrada y salida.
- Los productos con control de **serial** requieren especificar el número de serie individual.

### 15.7 Idempotencia contable

El sistema de contabilidad automática es idempotente: si el proceso de contabilización se ejecuta múltiples veces para el mismo documento (por cualquier motivo técnico), solo se crea **un único asiento**. Los intentos adicionales se detectan y se ignoran automáticamente.

### 15.8 Contabilidad no bloquea operaciones

Si la contabilidad no está configurada correctamente (cuentas no asignadas), los asientos automáticos fallan silenciosamente. Esto significa que:
- La operación comercial (factura, cobro, pago) **sí se confirma** correctamente.
- El stock **sí se actualiza**.
- La CxC/CxP **sí se crea**.
- Solo el asiento contable queda sin generar.

Esto permite usar el sistema operativamente antes de finalizar la configuración contable.

### 15.9 Ecuación contable

El sistema garantiza que todo asiento esté cuadrado antes de guardarlo:

```
ΣDEBE = ΣHABER
```

Si hay una diferencia (por mínima que sea), el sistema rechaza el asiento. El Balance de Comprobación permite verificar en cualquier momento que todos los asientos históricos cumplen esta ecuación.

---

## 16. Apéndice Técnico

### 16.1 Stack tecnológico

| Componente | Tecnología | Hosting |
|---|---|---|
| **Frontend** | Next.js 16 + React 19 + TypeScript | Vercel |
| **Estilos** | Tailwind CSS v3 + shadcn/ui + Radix UI | — |
| **Backend API** | .NET 8 / ASP.NET Core Web API | Railway |
| **ORM** | Entity Framework Core 8 con Npgsql | — |
| **Base de datos** | PostgreSQL 16 | Neon (serverless, US East) |
| **Autenticación** | JWT + Cookies HttpOnly + Refresh Token | — |
| **PDF** | QuestPDF (facturas, recibos) | — |

### 16.2 Estructura de módulos de la API

| Controlador | Ruta base | Descripción |
|---|---|---|
| AuthController | `/api/auth` | Login, refresh token, registro |
| AccountsController | `/api/accounts` | Plan de cuentas |
| AccountingConfigController | `/api/accountingconfig` | Configuración contable |
| AccountingReportsController | `/api/accountingreports` | 4 reportes financieros |
| ARInvoicesController | `/api/arinvoices` | Cuentas por cobrar |
| ARSalesReceiptsController | `/api/arsalesreceipts` | Cobros de clientes |
| APInvoicesController | `/api/apinvoices` | Cuentas por pagar |
| PaymentsMadeController | `/api/paymentsmade` | Pagos a proveedores |
| SalesInvoicesController | `/api/salesinvoices` | Facturas de venta |
| SalesOrdersController | `/api/salesorders` | Pedidos de venta |
| PurchaseOrdersController | `/api/purchaseorders` | Órdenes de compra |
| PurchaseReceiptsController | `/api/purchasereceipts` | Recepciones de compra |
| ProductsController | `/api/products` | Catálogo de productos |
| CategoriesController | `/api/categories` | Categorías de productos |
| StockController | `/api/stock` | Entradas, salidas, transferencias |
| BanksController | `/api/banks` | Bancos y cuentas bancarias |
| CashBoxesController | `/api/cashboxes` | Cajas registradoras |
| ReportMenuController | `/api/reportmenu` | Menú de reportes (DB-driven) |
| PermissionsController | `/api/permissions` | Gestión de permisos por rol |
| UsersController | `/api/users` | Administración de usuarios |

### 16.3 Seeders automáticos

Al arrancar la API, se ejecutan automáticamente los siguientes seeders que inicializan datos base si no existen:

| Seeder | Qué inicializa |
|---|---|
| `UserSeeder` | Usuario administrador por defecto |
| `PermissionSeeder` | Todos los permisos del sistema + permisos por defecto del rol USER |
| `ReportMenuSeeder` | Menú de reportes base + grupo Contabilidad con 4 reportes |
| `AppRoleSeeder` | Roles del sistema (ADMIN, USER, CAJERO, SUPERVISOR, VENTAS) |
| `AccountSeeder` | Plan de Cuentas estándar estilo SAP Business One |
| `AccountingConfigSeeder` | Claves de configuración contable globales (sin cuentas asignadas) |

Los seeders son **idempotentes**: si los datos ya existen, no crean duplicados. Son seguros de ejecutar múltiples veces.

### 16.4 Flujo de autenticación

```
1. Usuario ingresa usuario/contraseña
2. API valida credenciales → genera Access Token (JWT) + Refresh Token
3. Ambos tokens se almacenan en cookies HttpOnly (no accesibles por JavaScript)
4. Cada petición envía las cookies automáticamente
5. El middleware del servidor valida el JWT en cada petición
6. Cuando el Access Token expira, el frontend usa el Refresh Token para obtener uno nuevo
7. Al cerrar sesión, ambos tokens se invalidan en el servidor
```

### 16.5 Convenciones de datos

- **Moneda:** todos los montos se almacenan como `decimal` con precisión de 2 decimales. La moneda base del sistema es el Guaraní Paraguayo (PYG).
- **Fechas:** se almacenan en UTC. El frontend muestra las fechas en horario local.
- **Textos clave:** los códigos de cuentas y nombres de cuentas se almacenan en **MAYÚSCULAS**.
- **Soft delete:** los registros usan `IsActive = false` en lugar de eliminación física.

---

*Manual de usuario Mega7 ERP — Versión 2.0 — 25/06/2026*  
*Para soporte técnico o reportar errores: christtian.morales@gmail.com*
