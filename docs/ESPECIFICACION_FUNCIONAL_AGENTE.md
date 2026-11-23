# Especificación Funcional — Olimpíadas Literarias (Referencia para Agentes y Desarrollo)

[English](FUNCTIONAL_SPECIFICATION_AGENT.md) | **Español**

**Audiencia:** Agentes de IA, Arquitectos de Software y Desarrolladores  
**Idioma de la aplicación:** Español (100% de UI, alertas y correos)  
**Zona horaria oficial:** `America/Caracas` (UTC-4)

---

## 1. Visión General y Matriz de Roles

**Olimpíadas Literarias** es una plataforma anual multiedición de relatos cortos con cuentas permanentes y 4 roles globales asignados por el Superadministrador:

| Rol | ¿Concursa? | Capacidades Principales |
| :--- | :---: | :--- |
| **`PARTICIPANT`** | **Sí** | Inscripción anual, envío de cuentos por consigna, selección y edición de 1 cuento final, lectura y votación anónima Top 3, y gestión completa de perfil. |
| **`JURY`** | **No** | Activo solo en *Evaluación del Jurado* y *Desempate*. Lee el Top 10+ de finalistas de forma anónima y vota 1.º, 2.º y 3.º lugar sin ver puntajes previos. |
| **`ADMIN`** | **No** | Banco colaborativo de consignas (proponer, comentar, votar anónimamente), validación del paquete de consignas, estadísticas en tiempo real, lectura/comparación de cuentos, alertas de modificación excesiva, intervenciones manuales con justificación obligatoria, historial de auditoría y publicación de ganadores. |
| **`SUPERADMIN`** | **No** | Todas las capacidades de `ADMIN` más configuración exclusiva: ediciones y fechas, parámetros del certamen, armado de consignas de edición, plantillas de correo (`E01`–`E26`), páginas públicas (*Bases*, *¿Quiénes somos?*) y gestión de roles. |

---

## 2. Autenticación, Perfil y Sesión por Inactividad

- **Correo y Contraseña:** verificación previa de correo duplicado (`POST /api/auth/check-email`) con enlaces directos a inicio de sesión/recuperación; política de contraseña segura (**mínimo 8 caracteres** y **al menos 3 de 4**: mayúscula, minúscula, número, carácter especial) mostrada en un tooltip informativo; botón para revelar contraseña; verificación `E01` y recuperación `E02`.
- **Google y Microsoft OAuth:** inicio de sesión en 1 clic con precarga automática de nombre, apellido y foto de perfil (editables) y redirección directa a `/concurso` (con compuerta `/completar-perfil` si faltan país o teléfono).
- **Teléfono unificado por país:** campo dividido visualmente por una línea vertical con prefijo autocompletado y formato de ejemplo real acorde al país seleccionado.
- **Perfil (`/perfil`):** edición de datos personales, re-verificación si cambia el correo, subida de avatar a R2, cambio de contraseña, **Eliminar cuenta** (izquierda, con modal de confirmación y protección del último `SUPERADMIN`) y **Cerrar sesión** (derecha).
- **Cierre automático por inactividad:** expiración a los **15 minutos** si la pestaña está cerrada; aviso modal con cuenta regresiva de **5 minutos** a los **25 minutos** de inactividad con la pestaña abierta (cierre automático a los **30 minutos**).

---

## 3. Navegación Editorial y Ciclo del Concurso

- **Sistema Visual Editorial Ámbar SiTeLoCuento (`#D47E17`):** barra superior fija (emblema y título a la izquierda; nombre de usuario + acceso a espacio de trabajo a la derecha, ocultando «Entrar» en `/login` y `/registro`; logotipo de SiTeLoCuento exclusivamente en `/`), menú inferior flotante compacto con coreografía GSAP *orchestrated ease-reverse* y desplazamiento por bloques de pantalla completa en `/` con cortina ámbar de transición.
- **Ciclo de 7 Etapas + Catálogo `E01`–`E26`:** las reglas exactas de validación de fechas (con dos márgenes obligatorios de 48 horas), cálculo de fallas, similitud mínima, ventana de corrección 24h+24h, votación anónima determinista, multiplicador de jurado $K$, desempate condicional y las 26 plantillas de correo automático están especificadas al detalle en la referencia canónica: [`FUNCTIONAL_SPECIFICATION_AGENT.md`](FUNCTIONAL_SPECIFICATION_AGENT.md).
