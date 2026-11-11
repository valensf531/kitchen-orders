# Reporte periódico al dueño por WhatsApp — análisis y propuesta

_Idea: enviar diaria, semanal, quincenal o mensualmente un resumen del negocio al dueño por WhatsApp. Se analiza también la alternativa por email._

## Mi opinión

La idea es muy buena y ya está en el roadmap (#5). Para un restaurante, el resumen periódico es una de las funciones con mejor relación valor/esfuerzo: el dueño percibe el resultado del sistema sin tener que entrar al panel, y eso ayuda mucho a la retención.

Pero haría una distinción importante: **el valor está en el motor de reportes y en el hábito, no en WhatsApp en sí**. WhatsApp es el canal con más fricción técnica y legal (cuenta de Meta, plantillas aprobadas, opt-in, costos por mensaje). Por eso mi recomendación es:

1. Construir el motor de reportes agnóstico al canal.
2. Validarlo primero con email y/o un botón "Compartir por WhatsApp" (gratis y manual).
3. Sumar WhatsApp Cloud API automatizado como fase 2, con un piloto controlado.

Si el dueño real ya lo pide y estás dispuesto a hacer el trámite de Meta, se puede ir directo a WhatsApp, pero el 70% del trabajo es el mismo motor.

## Pros

- **Retención y percepción de valor**: el dueño ve ventas, ticket promedio y platos top sin abrir el panel.
- **Bajo costo marginal**: en Argentina, una plantilla utility cuesta ~USD 0,026–0,03 por mensaje (noviembre 2026). Un reporte diario son ~USD 0,80/mes por restaurante; semanal ~USD 0,12; mensual ~USD 0,03.
- **Los datos ya existen**: `statsStore` ya calcula ventas, cobrado, pendiente, ticket promedio, top productos, ventas por día/hora/zona/canal, medios de pago, cancelaciones y tiempos de cocina.
- **Zona horaria y moneda ya son por restaurante** (`restaurant_settings`), así que el mensaje puede salir bien formateado por cliente.
- **WhatsApp es el canal natural en Argentina**: más efectivo que email para dueños de restaurantes.
- **Frecuencia configurable**: el mismo motor sirve para diario, semanal, quincenal y mensual.
- **Se puede medir**: clics al panel, respuestas y bajas. Sirve para justificar la función y ajustar el contenido.

## Contras y riesgos

- **Fricción de Meta**: hace falta cuenta de Meta Business, número dedicado, método de pago, plantillas aprobadas en español y opt-in explícito del dueño. La verificación y aprobación pueden demorar.
- **No se puede mandar texto libre**: fuera de la ventana de 24 horas solo se pueden enviar plantillas pre-aprobadas. El resumen tiene que ser una plantilla fija con variables; el detalle rico va en un link al panel.
- **Categoría de la plantilla**: si el mensaje parece promocional, Meta lo recategoriza como marketing (más caro) o lo rechaza. Nada de promos ni "tips" comerciales en la plantilla utility.
- **Opt-in y baja**: hay que guardar consentimiento y manejar "BAJA"/"STOP". También conviene un webhook de estados (entregado, leído, fallido).
- **Costo y operación**: no es gratis, hay que gestionar tokens, reintentos, errores y calidad de la plantilla.
- **Número central vs número del restaurante**: lo simple es enviar desde un número central de Lumen. Si querés que salga del número del local, cada cliente tiene que onboardear su propia WABA: mucha más fricción.
- **Privacidad**: las cifras de ventas pasan por Meta y se ven en la notificación del celular. Hay que avisarlo en la política de privacidad.
- **Ruido**: un reporte diario puede quemar al dueño. Semanal suele ser mejor default; diario solo si lo pide.
- **Idempotencia y zona horaria**: si el servidor se reinicia o el cron corre dos veces, no puede duplicar el envío. Hay que registrar cada entrega.
- **Hoy no existe nada de esto**: no hay campo teléfono, preferencias, scheduler, cliente de email ni de WhatsApp.
- **Dependencia de un tercero**: cambios de precios o políticas de Meta pueden romper la función.

## Alternativa: hacerlo por email

Sí, y de hecho es la forma más sensata de arrancar. El motor de reportes es el mismo; cambia solo el transporte.

### Comparación rápida

| Criterio | Email | WhatsApp |
| --- | --- | --- |
| Costo | Casi cero (Resend/SES/SMTP) | ~USD 0,03 por mensaje entregado |
| Fricción de alta | Baja: ya tenés `user.email` | Alta: Meta Business, número, plantillas, opt-in |
| Formato | Libre: HTML, texto largo, PDF adjunto | Plantilla fija, máximo 1024 caracteres |
| Apertura e inmediatez | Menor | Mayor, sobre todo en Argentina |
| Implementación | 2–3 días | 1–2 semanas más trámite de Meta |
| Baja / consentimiento | Buena práctica, link de baja | Obligatorio para Meta |

### Qué ganás con email

- Cero trámite de Meta: sin cuenta Business, sin plantillas aprobadas, sin opt-in de WhatsApp y sin costo por mensaje.
- Contenido libre: HTML, texto largo, gráficos o PDF adjunto, sin el límite de 1024 caracteres ni la estructura fija de una plantilla.
- Ya tenés el email del dueño en `user.email`; no hace falta agregar teléfono ni validar un número.
- Implementación de 2–3 días contra 1–2 semanas de WhatsApp más el trámite de Meta.
- Costo casi nulo: Resend, SES o SMTP propio.
- Mejor para dueños que administran desde la computadora y para adjuntar un reporte completo.

### Qué perdés

- Apertura e inmediatez: el dueño no vive en el email y muchos no lo leen.
- Deliverability: puede caer en spam si el dominio no tiene SPF/DKIM/DMARC, y los emails de restaurante suelen estar saturados o compartidos.
- El reporte diario por email se ignora más fácil; el semanal funciona mejor.
- El HTML de email requiere maquetado aparte para Gmail/Outlook; es más trabajo de diseño que un texto de WhatsApp.
- No tiene la cercanía de WhatsApp, que en Argentina es donde está el dueño.

### Recomendación

- Email semanal por defecto (lunes 9:00), con resumen corto en el cuerpo, link al panel y PDF opcional.
- Diario solo como opt-in, y quizás más adelante por WhatsApp.
- Diseñar `report-render` con dos salidas desde el principio: HTML/texto para email y parámetros de plantilla para WhatsApp. Así sumás WhatsApp después sin rehacer el motor.
- Proveedor: Resend para arrancar rápido, o SMTP configurable si un cliente quiere su propio servidor. Verificar el dominio para no caer en spam.
- Mantener igual el registro de entregas, la idempotencia y la baja.

En resumen: email primero es más rápido, barato y sin dependencias; WhatsApp queda como upgrade para los dueños que lo pidan.

### Cambios técnicos respecto de la propuesta original

- `report_settings`: agregar `channel` (`email`, `whatsapp` o `both`). Para el MVP, el email sale de `user.email`; el teléfono queda para la fase de WhatsApp.
- `report-render.ts`: dos salidas, HTML/texto para email y parámetros de plantilla para WhatsApp, a partir del mismo objeto de resumen.
- `email.ts`: Resend o SMTP configurable por env (`RESEND_API_KEY` y `EMAIL_FROM`, o `SMTP_URL`).
- Verificar el dominio del remitente (SPF, DKIM y DMARC) para deliverability; incluir link de baja.
- El HTML de email requiere diseño responsive y conviene una versión de texto plano.
- El PDF adjunto se puede agregar después con la misma data; no bloquea el MVP.

## Qué información incluiría

Regla general: **5 a 8 líneas, números clave, una comparación, top 3 y un link**. El detalle completo va en el panel; el mensaje es el gancho, no el reporte.

### Diario (opt-in)

- Ventas del día y comparación con el mismo día de la semana anterior.
- Cobrado, pendiente de cobro y ticket promedio.
- Cantidad de pedidos y cancelados.
- Top 3 productos (unidades).
- Hora pico y tiempo promedio de cocina.
- Estado de caja: cerrada con diferencia, o "caja sin cerrar".
- Link "Ver detalle".

### Semanal (default recomendado)

- Ventas de la semana vs. semana anterior.
- Pedidos, ticket promedio, cobrado y pendiente.
- Mejor día y día más flojo.
- Top 5 productos.
- Ventas por canal (salón vs. QR) y medios de pago.
- Tiempos de cocina: promedio, P90 y pedidos demorados.
- Cancelados y motivo principal.
- Diferencia de caja acumulada.
- Link al reporte.

### Quincenal

- Lo mismo que el semanal, con foco en flujo de caja: facturado, cobrado, pendiente, medios de pago y diferencias de caja.
- Definir si es 1–15 / 16–fin de mes o cada 14 días. En Argentina suele ser 1 y 15.

### Mensual

- Ventas del mes vs. mes anterior.
- Mejor semana, ticket promedio y pedidos.
- Top 10 productos y categorías top.
- Productos del menú sin ventas (oportunidad).
- Canales, medios de pago, días y horas fuertes.
- Tiempos de cocina y cancelaciones.
- Diferencias de caja del mes.
- Link al reporte del mes.

### Lo que NO incluiría

- Promociones o descuentos: cambia la categoría de la plantilla a marketing.
- Datos personales de clientes.
- Demasiadas métricas: el mensaje se vuelve ilegible y el dueño lo ignora.
- Reportes sin datos: en diario, si no hubo ventas, mejor omitir; en semanal/mensual, mandar aunque sea cero porque es información.

## Cómo lo implementaría

### Fase 0 — Definiciones (medio día)

- Frecuencia default, horario de envío, texto de consentimiento, quién recibe y qué número envía.
- Definir si el link al panel requiere login (recomendado) o si es un link firmado con expiración.

### Fase 1 — Motor + email (2–4 días)

- Tablas `report_settings` y `report_deliveries`.
- Cálculo de períodos en la zona horaria del restaurante (incluye comparación con el período anterior).
- Render del resumen reutilizando `statsStore` y `stats-format`.
- Envío por email al `user.email` del dueño con Resend o SMTP.
- Endpoint `POST /api/reports/run` protegido con `REPORT_CRON_SECRET`, pensado para un cron externo (Dokploy o VPS).
- UI en Configuración → Reportes: canal, frecuencia, horario, email/teléfono, consentimiento, botón "Enviar prueba", historial y baja.
- Tests de zonas horarias, períodos, idempotencia y formato.

### Fase 2 — WhatsApp manual (medio día)

- Botón "Compartir por WhatsApp" en Estadísticas que abre `wa.me` con el resumen precargado.
- Sirve para validar el contenido y el hábito sin depender de Meta.
- Mientras tanto, recolectar opt-in de los dueños que quieran recibirlo automático.

### Fase 3 — WhatsApp Cloud API (1–2 semanas, incluye trámite de Meta)

- Cliente `whatsapp.ts` contra Cloud API, con timeout, reintentos y manejo de errores.
- Cuatro plantillas es_AR: `resumen_diario`, `resumen_semanal`, `resumen_quincenal`, `resumen_mensual`, con variables de texto y botón URL al panel.
- Webhook `/api/webhooks/whatsapp` para estados y bajas, verificando `X-Hub-Signature-256`.
- Registro de `provider_message_id`, estado y error en `report_deliveries`.
- Piloto con número de prueba (hasta 5 destinatarios) y luego número productivo.
- Cron cada hora o una vez al día; el endpoint decide si a ese restaurante le toca en su horario local y evita duplicados.

### Detalles técnicos clave

- **Idempotencia**: unique `(user_id, kind, period_start, channel)` en `report_deliveries`.
- **Zona horaria**: calcular los límites del día/semana/mes con la timezone del restaurante, no con la del servidor.
- **Moneda**: usar `currencySymbol` del restaurante.
- **Comparaciones**: mismo día de la semana para diario; misma cantidad de días para períodos parciales.
- **Terminología**: "Ventas", "Cobrado", "Pendiente de cobro", "Ticket promedio", igual que el dashboard.
- **Seguridad**: secreto para el cron, firma del webhook, teléfonos en E.164, no loguear cifras ni cuerpos de mensajes.
- **Costos**: absorberlos en el abono. A escala (1.000 restaurantes con diario) son ~USD 800/mes; si crece, conviene un plan premium o limitar diario.

## Ejemplo de mensaje semanal

```text
Lumen · semana 3–9 nov

Ventas: $1.245.300 (+8% vs. semana anterior)
Pedidos: 312 · Ticket promedio: $3.990
Mejor día: sábado ($298.400) · Más flojo: martes ($98.200)
Top: milanesa (48), empanadas (41), flan (33)
Cobrado: $1.180.000 · Pendiente: $65.300
Cocina: 14 min prom. · 8 pedidos demorados
Cancelados: 6 ($24.000)
Caja: diferencia $0

Ver reporte completo →
```

## Lo que decidiría antes de escribir código

1. ¿WhatsApp automatizado desde el día 1, o email + botón "Compartir por WhatsApp" primero? **Recomiendo lo segundo.**
2. ¿Frecuencia default? **Recomiendo semanal, lunes 9:00**, con diario como opt-in.
3. ¿El mensaje sale de un número central de Lumen o del número de cada restaurante? **Recomiendo central.**
4. ¿Solo el dueño o también socio/encargado? Recomiendo empezar solo con el dueño.
5. ¿Link al panel con login o link público firmado? **Recomiendo login**, para no exponer ventas.
6. ¿Quién paga los mensajes? Recomiendo incluirlos en el abono.
7. ¿Ya tenés cuenta de Meta Business o número listo? Eso define si la fase 3 puede arrancar en paralelo.

## Referencias

- Meta, precios de WhatsApp Business Platform (vigentes desde octubre 2026): utility en Argentina ~USD 0,026 por mensaje entregado; 1.000 mensajes de servicio gratis por número y por mes, pero **no aplica a plantillas**.
- Para automatizar hacen falta plantillas aprobadas, opt-in y un número dedicado. Las plantillas utility no pueden mezclar promociones.
