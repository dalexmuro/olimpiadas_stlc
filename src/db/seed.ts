/**
 * Database Seed Catalog & Initializer
 * Step 1.7: Initial seed for E01-E26 email templates, static public pages, and initial SUPERADMIN promotion
 */

import { eq } from "drizzle-orm";
import type { AppDatabase } from "./index";
import { emailTemplates, sitePages, users } from "./schema";

export const EMAIL_TEMPLATE_TAGS = [
  "{{NOMBRE}}",
  "{{APELLIDO}}",
  "{{EMAIL}}",
  "{{EDICION}}",
  "{{NUMERO_CONSIGNA}}",
  "{{TITULO_CONSIGNA}}",
  "{{TITULO_CUENTO}}",
  "{{CANTIDAD_FALLAS}}",
  "{{MAX_FALLAS}}",
  "{{FECHA_HORA_CIERRE}}",
  "{{LINK_PLATAFORMA}}",
  "{{LINK_RESULTADOS}}",
] as const;

export type EmailTemplateTag = (typeof EMAIL_TEMPLATE_TAGS)[number];

export interface EmailTemplateSeedItem {
  code: string;
  name: string;
  description: string;
  subjectTemplate: string;
  bodyHtmlTemplate: string;
  availableTags: readonly EmailTemplateTag[];
}

export interface SitePageSeedItem {
  slug: "bases-del-concurso" | "quienes-somos";
  title: string;
  contentHtml: string;
}

/**
 * Complete catalog of all 26 automated emails (E01 to E26) defined in
 * docs/FUNCTIONAL_SPECIFICATION_AGENT.md Section 8.2.
 */
export const DEFAULT_EMAIL_TEMPLATES: readonly EmailTemplateSeedItem[] = [
  {
    code: "E01",
    name: "Creación de cuenta y verificación de correo",
    description:
      "Se envía al usuario cuando crea su cuenta en el sitio web para darle la bienvenida y verificar su correo.",
    subjectTemplate:
      "Bienvenido/a a las Olimpíadas Literarias, {{NOMBRE}}",
    bodyHtmlTemplate:
      "<p>Hola <strong>{{NOMBRE}} {{APELLIDO}}</strong>,</p><p>Tu cuenta en la plataforma de las <strong>Olimpíadas Literarias</strong> ha sido creada con éxito.</p><p>Por favor verifica tu dirección de correo electrónico o accede a tu cuenta haciendo clic aquí: <a href=\"{{LINK_PLATAFORMA}}\">{{LINK_PLATAFORMA}}</a></p>",
    availableTags: [
      "{{NOMBRE}}",
      "{{APELLIDO}}",
      "{{EMAIL}}",
      "{{LINK_PLATAFORMA}}",
    ],
  },
  {
    code: "E02",
    name: "Recuperación de contraseña",
    description:
      "Se envía cuando un usuario solicita restablecer su contraseña olvidada.",
    subjectTemplate:
      "Recuperación de contraseña — Olimpíadas Literarias",
    bodyHtmlTemplate:
      "<p>Hola <strong>{{NOMBRE}}</strong>,</p><p>Hemos recibido una solicitud para restablecer la contraseña de tu cuenta ({{EMAIL}}).</p><p>Haz clic en el siguiente enlace seguro para crear una nueva contraseña: <a href=\"{{LINK_PLATAFORMA}}\">{{LINK_PLATAFORMA}}</a></p>",
    availableTags: ["{{NOMBRE}}", "{{EMAIL}}", "{{LINK_PLATAFORMA}}"],
  },
  {
    code: "E03",
    name: "Confirmación de inscripción en el concurso",
    description:
      "Se envía al participante apenas confirma su inscripción en la edición anual activa.",
    subjectTemplate: "Inscripción confirmada en {{EDICION}}",
    bodyHtmlTemplate:
      "<p>Hola <strong>{{NOMBRE}} {{APELLIDO}}</strong>,</p><p>¡Tu inscripción en <strong>{{EDICION}}</strong> ha quedado oficialmente registrada!</p><p>Puedes consultar el calendario de etapas y tu estado actual en: <a href=\"{{LINK_PLATAFORMA}}\">{{LINK_PLATAFORMA}}</a></p>",
    availableTags: [
      "{{NOMBRE}}",
      "{{APELLIDO}}",
      "{{EDICION}}",
      "{{LINK_PLATAFORMA}}",
    ],
  },
  {
    code: "E04",
    name: "Recordatorio 24h antes de iniciar etapa de envío de cuentos",
    description:
      "Se envía a todos los participantes inscritos el día antes de comenzar la Etapa 2.",
    subjectTemplate: "Mañana comienza la etapa de escritura de {{EDICION}}",
    bodyHtmlTemplate:
      "<p>Hola <strong>{{NOMBRE}}</strong>,</p><p>Te recordamos que mañana inicia la etapa de envío de cuentos de <strong>{{EDICION}}</strong>.</p><p>Prepárate e ingresa a la plataforma en: <a href=\"{{LINK_PLATAFORMA}}\">{{LINK_PLATAFORMA}}</a></p>",
    availableTags: ["{{NOMBRE}}", "{{EDICION}}", "{{LINK_PLATAFORMA}}"],
  },
  {
    code: "E05",
    name: "Nueva consigna disponible",
    description:
      "Se envía a los participantes activos cuando se publica una nueva consigna en la Etapa 2.",
    subjectTemplate:
      "¡Ya está disponible la Consigna #{{NUMERO_CONSIGNA}} de {{EDICION}}!",
    bodyHtmlTemplate:
      "<p>Hola <strong>{{NOMBRE}}</strong>,</p><p>Ya está abierta la <strong>Consigna #{{NUMERO_CONSIGNA}}: {{TITULO_CONSIGNA}}</strong> en <strong>{{EDICION}}</strong>.</p><p>Tienes hasta el <strong>{{FECHA_HORA_CIERRE}}</strong> (hora de Caracas) para enviar y editar tu cuento: <a href=\"{{LINK_PLATAFORMA}}\">{{LINK_PLATAFORMA}}</a></p>",
    availableTags: [
      "{{NOMBRE}}",
      "{{EDICION}}",
      "{{NUMERO_CONSIGNA}}",
      "{{TITULO_CONSIGNA}}",
      "{{FECHA_HORA_CIERRE}}",
      "{{LINK_PLATAFORMA}}",
    ],
  },
  {
    code: "E06",
    name: "Recordatorio 1 hora antes del cierre de consigna",
    description:
      "Se envía a participantes activos que aún no han enviado cuento cuando falta 1 hora para cerrar la consigna.",
    subjectTemplate:
      "¡Última hora! Falta 1 hora para cerrar la Consigna #{{NUMERO_CONSIGNA}}",
    bodyHtmlTemplate:
      "<p>Hola <strong>{{NOMBRE}}</strong>,</p><p>Falta menos de <strong>1 hora</strong> para el cierre de la <strong>Consigna #{{NUMERO_CONSIGNA}} ({{TITULO_CONSIGNA}})</strong> y aún no hemos recibido tu cuento.</p><p>Hora límite: <strong>{{FECHA_HORA_CIERRE}}</strong> (hora de Caracas). Entra ahora en: <a href=\"{{LINK_PLATAFORMA}}\">{{LINK_PLATAFORMA}}</a></p>",
    availableTags: [
      "{{NOMBRE}}",
      "{{EDICION}}",
      "{{NUMERO_CONSIGNA}}",
      "{{TITULO_CONSIGNA}}",
      "{{FECHA_HORA_CIERRE}}",
      "{{LINK_PLATAFORMA}}",
    ],
  },
  {
    code: "E07",
    name: "Advertencia de límite de fallas alcanzado",
    description:
      "Se envía cuando el participante alcanza exactamente el máximo de fallas permitidas (sigue concursando pero no puede fallar de nuevo).",
    subjectTemplate:
      "Atención: has alcanzado el límite de fallas permitidas en {{EDICION}}",
    bodyHtmlTemplate:
      "<p>Hola <strong>{{NOMBRE}}</strong>,</p><p>Atención, has fallado <strong>{{CANTIDAD_FALLAS}}</strong> veces (el máximo permitido es {{MAX_FALLAS}}). Si fallas de nuevo en una próxima consigna, serás descalificado del concurso.</p><p>Revisa el calendario de la próxima consigna en: <a href=\"{{LINK_PLATAFORMA}}\">{{LINK_PLATAFORMA}}</a></p>",
    availableTags: [
      "{{NOMBRE}}",
      "{{EDICION}}",
      "{{CANTIDAD_FALLAS}}",
      "{{MAX_FALLAS}}",
      "{{LINK_PLATAFORMA}}",
    ],
  },
  {
    code: "E08",
    name: "Recordatorio 24h antes de iniciar etapa de postulación y edición",
    description:
      "Se envía a los participantes activos el día antes de comenzar la Etapa 3.",
    subjectTemplate:
      "Mañana inicia la etapa de selección y edición de cuentos en {{EDICION}}",
    bodyHtmlTemplate:
      "<p>Hola <strong>{{NOMBRE}}</strong>,</p><p>Mañana comienza la etapa de selección, edición y postulación de tu cuento para <strong>{{EDICION}}</strong>.</p><p>Ingresa a la plataforma en: <a href=\"{{LINK_PLATAFORMA}}\">{{LINK_PLATAFORMA}}</a></p>",
    availableTags: ["{{NOMBRE}}", "{{EDICION}}", "{{LINK_PLATAFORMA}}"],
  },
  {
    code: "E09",
    name: "Recordatorio 1 hora antes del cierre de postulación",
    description:
      "Se envía cuando falta 1 hora para cerrar la Etapa 3 y el participante activo aún no ha postulado su cuento.",
    subjectTemplate:
      "¡Última hora! Falta 1 hora para cerrar la postulación en {{EDICION}}",
    bodyHtmlTemplate:
      "<p>Hola <strong>{{NOMBRE}}</strong>,</p><p>Falta menos de <strong>1 hora</strong> ({{FECHA_HORA_CIERRE}}, hora de Caracas) para que cierre la etapa de postulación y aún no has postulado definitivamente tu cuento.</p><p>Recuerda que si no pulsas el botón <strong>Postular</strong> antes del cierre, quedarás descalificado: <a href=\"{{LINK_PLATAFORMA}}\">{{LINK_PLATAFORMA}}</a></p>",
    availableTags: [
      "{{NOMBRE}}",
      "{{EDICION}}",
      "{{FECHA_HORA_CIERRE}}",
      "{{LINK_PLATAFORMA}}",
    ],
  },
  {
    code: "E10",
    name: "Confirmación de cuento postulado",
    description:
      "Se envía al participante apenas confirma la postulación definitiva de su cuento en la Etapa 3.",
    subjectTemplate: "Tu cuento «{{TITULO_CUENTO}}» ha sido postulado en {{EDICION}}",
    bodyHtmlTemplate:
      "<p>Hola <strong>{{NOMBRE}}</strong>,</p><p>Confirmamos que tu cuento <strong>«{{TITULO_CUENTO}}»</strong> ha sido postulado exitosamente para competir en <strong>{{EDICION}}</strong>.</p><p>Puedes ver el estado del concurso en: <a href=\"{{LINK_PLATAFORMA}}\">{{LINK_PLATAFORMA}}</a></p>",
    availableTags: [
      "{{NOMBRE}}",
      "{{EDICION}}",
      "{{TITULO_CUENTO}}",
      "{{LINK_PLATAFORMA}}",
    ],
  },
  {
    code: "E11",
    name: "Alerta de exceso de modificaciones para Administradores",
    description:
      "Se envía a todos los Administradores cuando un administrador lanza una alerta sobre un cuento editado.",
    subjectTemplate:
      "[Admin] Alerta de revisión de cuento modificado: «{{TITULO_CUENTO}}»",
    bodyHtmlTemplate:
      "<p>Hola <strong>{{NOMBRE}}</strong>,</p><p>Se ha lanzado una alerta por exceso de modificaciones sobre el cuento <strong>«{{TITULO_CUENTO}}»</strong> en <strong>{{EDICION}}</strong>.</p><p>Por favor ingresa al panel de administración para comparar la versión original con la editada y emitir tu validación: <a href=\"{{LINK_PLATAFORMA}}\">{{LINK_PLATAFORMA}}</a></p>",
    availableTags: [
      "{{NOMBRE}}",
      "{{EDICION}}",
      "{{TITULO_CUENTO}}",
      "{{LINK_PLATAFORMA}}",
    ],
  },
  {
    code: "E12",
    name: "Solicitud de corrección de cuento en 24h al participante",
    description:
      "Se envía al participante al finalizar la Etapa 4 si su cuento con alerta no obtuvo al menos 2 validaciones de administradores.",
    subjectTemplate:
      "Acción requerida (24h): Revisión solicitada sobre tu cuento en {{EDICION}}",
    bodyHtmlTemplate:
      "<p>Hola <strong>{{NOMBRE}}</strong>,</p><p>El equipo de administradores ha revisado la edición de tu cuento <strong>«{{TITULO_CUENTO}}»</strong> y ha solicitado una revisión porque los cambios se alejan demasiado de la versión original.</p><p>Dispones excepcionalmente de <strong>24 horas</strong> (hasta el <strong>{{FECHA_HORA_CIERRE}}</strong>, hora de Caracas) para entrar al sistema, ajustar tu edición y volver a postular: <a href=\"{{LINK_PLATAFORMA}}\">{{LINK_PLATAFORMA}}</a></p>",
    availableTags: [
      "{{NOMBRE}}",
      "{{EDICION}}",
      "{{TITULO_CUENTO}}",
      "{{FECHA_HORA_CIERRE}}",
      "{{LINK_PLATAFORMA}}",
    ],
  },
  {
    code: "E13",
    name: "Aviso a Administradores de cuento corregido re-subido",
    description:
      "Se envía a todos los Administradores cuando el participante sube su cuento corregido dentro de la ventana de 24h.",
    subjectTemplate:
      "[Admin] Cuento corregido pendiente de validación: «{{TITULO_CUENTO}}»",
    bodyHtmlTemplate:
      "<p>Hola <strong>{{NOMBRE}}</strong>,</p><p>El autor ha subido la versión corregida del cuento <strong>«{{TITULO_CUENTO}}»</strong> dentro de su ventana excepcional de 24 horas.</p><p>Por favor entra al panel de alertas para validarlo antes del inicio de las votaciones ({{FECHA_HORA_CIERRE}}): <a href=\"{{LINK_PLATAFORMA}}\">{{LINK_PLATAFORMA}}</a></p>",
    availableTags: [
      "{{NOMBRE}}",
      "{{EDICION}}",
      "{{TITULO_CUENTO}}",
      "{{FECHA_HORA_CIERRE}}",
      "{{LINK_PLATAFORMA}}",
    ],
  },
  {
    code: "E14",
    name: "Inicio de la etapa de Votaciones de Participantes",
    description:
      "Se envía a todos los participantes activos cuando se abre la Etapa 5.",
    subjectTemplate: "¡Ya están abiertas las votaciones de {{EDICION}}!",
    bodyHtmlTemplate:
      "<p>Hola <strong>{{NOMBRE}}</strong>,</p><p>La etapa de votaciones de <strong>{{EDICION}}</strong> ya está abierta hasta el <strong>{{FECHA_HORA_CIERRE}}</strong> (hora de Caracas).</p><p>Entra a leer los cuentos postulados, preselecciona tus favoritos y emite tu voto Top 3 (recuerda que votar es obligatorio para continuar en competencia): <a href=\"{{LINK_PLATAFORMA}}\">{{LINK_PLATAFORMA}}</a></p>",
    availableTags: [
      "{{NOMBRE}}",
      "{{EDICION}}",
      "{{FECHA_HORA_CIERRE}}",
      "{{LINK_PLATAFORMA}}",
    ],
  },
  {
    code: "E15",
    name: "Recordatorio 1 hora antes del cierre de Votaciones",
    description:
      "Se envía cuando falta 1 hora para cerrar la Etapa 5 y el participante activo aún no ha votado.",
    subjectTemplate:
      "¡Última hora para votar en {{EDICION}}! Evita la descalificación",
    bodyHtmlTemplate:
      "<p>Hola <strong>{{NOMBRE}}</strong>,</p><p>Falta menos de <strong>1 hora</strong> ({{FECHA_HORA_CIERRE}}, hora de Caracas) para el cierre de las votaciones de <strong>{{EDICION}}</strong> y aún no has enviado tus votos.</p><p>Recuerda que los autores que no votan quedan descalificados. Entra a votar ahora: <a href=\"{{LINK_PLATAFORMA}}\">{{LINK_PLATAFORMA}}</a></p>",
    availableTags: [
      "{{NOMBRE}}",
      "{{EDICION}}",
      "{{FECHA_HORA_CIERRE}}",
      "{{LINK_PLATAFORMA}}",
    ],
  },
  {
    code: "E16",
    name: "Confirmación de voto enviado por Participante",
    description:
      "Se envía al participante apenas confirma y envía sus votos en la Etapa 5.",
    subjectTemplate: "Tus votos en {{EDICION}} han sido registrados",
    bodyHtmlTemplate:
      "<p>Hola <strong>{{NOMBRE}}</strong>,</p><p>Hemos registrado exitosamente tus votos para el Top 3 de <strong>{{EDICION}}</strong>. ¡Muchas gracias por tu lectura y participación!</p><p>Puedes seguir leyendo los cuentos en: <a href=\"{{LINK_PLATAFORMA}}\">{{LINK_PLATAFORMA}}</a></p>",
    availableTags: ["{{NOMBRE}}", "{{EDICION}}", "{{LINK_PLATAFORMA}}"],
  },
  {
    code: "E17",
    name: "Notificación de descalificación automática",
    description:
      "Se envía cuando un participante queda descalificado automáticamente por superar el máximo de fallas, no postular cuento, no superar la revisión de edición o no votar.",
    subjectTemplate: "Actualización sobre tu participación en {{EDICION}}",
    bodyHtmlTemplate:
      "<p>Hola <strong>{{NOMBRE}}</strong>,</p><p>Te informamos que has quedado fuera de la competencia en la edición actual de <strong>{{EDICION}}</strong> por no haber completado uno de los requisitos obligatorios dentro del plazo establecido.</p><p>Agradecemos tu entusiasmo y esperamos contar contigo en la próxima edición. Puedes ver los detalles en tu perfil: <a href=\"{{LINK_PLATAFORMA}}\">{{LINK_PLATAFORMA}}</a></p>",
    availableTags: ["{{NOMBRE}}", "{{EDICION}}", "{{LINK_PLATAFORMA}}"],
  },
  {
    code: "E18",
    name: "Notificación de descalificación manual por Administrador",
    description:
      "Se envía al participante descalificado manualmente indicando que el equipo se pondrá en contacto con él, y también se notifica a los administradores.",
    subjectTemplate: "Aviso importante sobre tu participación en {{EDICION}}",
    bodyHtmlTemplate:
      "<p>Hola <strong>{{NOMBRE}}</strong>,</p><p>Te informamos que tu participación en <strong>{{EDICION}}</strong> ha sido descalificada. El equipo de administradores se pondrá en contacto contigo a la brevedad para explicarte los motivos.</p>",
    availableTags: [
      "{{NOMBRE}}",
      "{{APELLIDO}}",
      "{{EMAIL}}",
      "{{EDICION}}",
      "{{LINK_PLATAFORMA}}",
    ],
  },
  {
    code: "E19",
    name: "Confirmación de reactivación / reincorporación al concurso",
    description:
      "Se envía al participante cuando un Administrador lo reincorpora manualmente o le carga un cuento tardío que lo reactiva automáticamente.",
    subjectTemplate: "¡Tu participación en {{EDICION}} ha sido reactivada!",
    bodyHtmlTemplate:
      "<p>Hola <strong>{{NOMBRE}}</strong>,</p><p>Te informamos que el equipo organizador ha reactivado tu participación en <strong>{{EDICION}}</strong>. ¡Ya puedes continuar concursando normalmente!</p><p>Ingresa a la plataforma en: <a href=\"{{LINK_PLATAFORMA}}\">{{LINK_PLATAFORMA}}</a></p>",
    availableTags: ["{{NOMBRE}}", "{{EDICION}}", "{{LINK_PLATAFORMA}}"],
  },
  {
    code: "E20",
    name: "Inicio de la etapa de Evaluación del Jurado",
    description:
      "Se envía exclusivamente a los miembros del Jurado cuando se abre la Etapa 6.",
    subjectTemplate:
      "[Jurado] Ya está abierta la evaluación de cuentos finalistas de {{EDICION}}",
    bodyHtmlTemplate:
      "<p>Estimado/a miembro del Jurado <strong>{{NOMBRE}} {{APELLIDO}}</strong>,</p><p>Ya está abierta la etapa de evaluación del jurado de <strong>{{EDICION}}</strong> hasta el <strong>{{FECHA_HORA_CIERRE}}</strong> (hora de Caracas).</p><p>Puedes ingresar a leer los cuentos finalistas, preseleccionar tus favoritos y emitir tu votación en: <a href=\"{{LINK_PLATAFORMA}}\">{{LINK_PLATAFORMA}}</a></p>",
    availableTags: [
      "{{NOMBRE}}",
      "{{APELLIDO}}",
      "{{EDICION}}",
      "{{FECHA_HORA_CIERRE}}",
      "{{LINK_PLATAFORMA}}",
    ],
  },
  {
    code: "E21",
    name: "Recordatorio 1 hora antes del cierre de Evaluación del Jurado",
    description:
      "Se envía a los miembros del Jurado que aún no han emitido su voto cuando falta 1 hora para el cierre de la Etapa 6.",
    subjectTemplate:
      "[Jurado] Recordatorio: falta 1 hora para el cierre de evaluación en {{EDICION}}",
    bodyHtmlTemplate:
      "<p>Hola <strong>{{NOMBRE}}</strong>,</p><p>Te recordamos que falta menos de <strong>1 hora</strong> ({{FECHA_HORA_CIERRE}}, hora de Caracas) para el cierre programado de la evaluación del jurado en <strong>{{EDICION}}</strong> y aún queda pendiente tu voto.</p><p>Ingresa para emitir tu votación aquí: <a href=\"{{LINK_PLATAFORMA}}\">{{LINK_PLATAFORMA}}</a></p>",
    availableTags: [
      "{{NOMBRE}}",
      "{{EDICION}}",
      "{{FECHA_HORA_CIERRE}}",
      "{{LINK_PLATAFORMA}}",
    ],
  },
  {
    code: "E22",
    name: "Confirmación de voto enviado por miembro del Jurado",
    description:
      "Se envía al miembro del Jurado apenas confirma su votación en la Etapa 6.",
    subjectTemplate:
      "[Jurado] Confirmación de votación recibida — {{EDICION}}",
    bodyHtmlTemplate:
      "<p>Estimado/a <strong>{{NOMBRE}} {{APELLIDO}}</strong>,</p><p>Tu votación como miembro del Jurado de <strong>{{EDICION}}</strong> ha quedado registrada correctamente. ¡Muchísimas gracias por tu valiosa colaboración!</p>",
    availableTags: [
      "{{NOMBRE}}",
      "{{APELLIDO}}",
      "{{EDICION}}",
      "{{LINK_PLATAFORMA}}",
    ],
  },
  {
    code: "E23",
    name: "Alerta a Administradores: Jurado pendiente de votar (Etapa en pausa)",
    description:
      "Se envía a los Administradores y Superadmin si vence el plazo de la Etapa 6 y algún miembro del jurado aún no ha votado.",
    subjectTemplate:
      "[Admin] Etapa del Jurado en pausa por voto pendiente en {{EDICION}}",
    bodyHtmlTemplate:
      "<p>Hola <strong>{{NOMBRE}}</strong>,</p><p>Se ha cumplido el horario de cierre de la evaluación del jurado de <strong>{{EDICION}}</strong>, pero al menos un miembro del jurado aún no ha emitido su voto. El cierre se ha puesto en pausa automáticamente hasta que todos los jurados voten.</p><p>Revisa el estado en el panel de administración: <a href=\"{{LINK_PLATAFORMA}}\">{{LINK_PLATAFORMA}}</a></p>",
    availableTags: ["{{NOMBRE}}", "{{EDICION}}", "{{LINK_PLATAFORMA}}"],
  },
  {
    code: "E24",
    name: "Activación de Ronda de Desempate del Jurado",
    description:
      "Se envía a todos los miembros del Jurado si al terminar la Etapa 6 existe un empate en cualquiera de los 3 primeros lugares.",
    subjectTemplate:
      "[Jurado] Ronda rápida de desempate activada en {{EDICION}}",
    bodyHtmlTemplate:
      "<p>Estimado/a <strong>{{NOMBRE}}</strong>,</p><p>Tras sumar las puntuaciones de <strong>{{EDICION}}</strong>, se ha producido un empate en el podio. Se ha habilitado una ronda rápida de desempate donde verás únicamente los cuentos empatados.</p><p>Por favor ingresa para elegir tu opción preferida: <a href=\"{{LINK_PLATAFORMA}}\">{{LINK_PLATAFORMA}}</a></p>",
    availableTags: ["{{NOMBRE}}", "{{EDICION}}", "{{LINK_PLATAFORMA}}"],
  },
  {
    code: "E25",
    name: "Paquete de consignas de la edición enviado a validación de Administradores",
    description:
      "Se envía a todos los Administradores cuando el Superadministrador envía la propuesta de consignas de la edición para su validación.",
    subjectTemplate:
      "[Admin] Propuesta de consignas de {{EDICION}} lista para tu validación",
    bodyHtmlTemplate:
      "<p>Hola <strong>{{NOMBRE}}</strong>,</p><p>El Superadministrador ha preparado la propuesta de consignas para <strong>{{EDICION}}</strong> y la ha enviado a validación del equipo de administradores.</p><p>Por favor ingresa al panel para revisarla y emitir tu voto de validación: <a href=\"{{LINK_PLATAFORMA}}\">{{LINK_PLATAFORMA}}</a></p>",
    availableTags: ["{{NOMBRE}}", "{{EDICION}}", "{{LINK_PLATAFORMA}}"],
  },
  {
    code: "E26",
    name: "Anuncio oficial de Ganadores",
    description:
      "Se envía a TODOS los participantes (incluidos eliminados), Jurado, Administradores y Superadmin cuando se lanza manualmente la Etapa 7.",
    subjectTemplate:
      "¡Conoce a los ganadores de las {{EDICION}}!",
    bodyHtmlTemplate:
      "<p>Hola <strong>{{NOMBRE}}</strong>,</p><p>¡Ha llegado el gran momento! Ya han sido anunciados los cuentos ganadores de las <strong>{{EDICION}}</strong>.</p><p>Agradecemos enormemente a todos los escritores, lectores y miembros del jurado que hicieron posible esta edición. Conoce a los ganadores y lee todos los cuentos finalistas aquí: <a href=\"{{LINK_RESULTADOS}}\">{{LINK_RESULTADOS}}</a></p>",
    availableTags: [
      "{{NOMBRE}}",
      "{{APELLIDO}}",
      "{{EDICION}}",
      "{{LINK_RESULTADOS}}",
      "{{LINK_PLATAFORMA}}",
    ],
  },
] as const;

/**
 * Default static public pages (*Bases del Concurso* and *¿Quiénes somos?*).
 */
export const DEFAULT_SITE_PAGES: readonly SitePageSeedItem[] = [
  {
    slug: "bases-del-concurso",
    title: "Bases del Concurso — Olimpíadas Literarias",
    contentHtml: [
      "<h2>Bases Oficiales de las Olimpíadas Literarias</h2>",
      "<p>Bienvenido/a a las <strong>Olimpíadas Literarias</strong>, el certamen anual de cuentos cortos organizado por el club de escritura <strong>SiTeLoCuento</strong>.</p>",
      "<h3>1. Participación e Inscripción</h3>",
      "<p>Podrán participar todos los escritores registrados en la plataforma que completen su perfil y acepten estas bases durante el período oficial de inscripciones. Todas las fechas y horas del certamen se rigen por la zona horaria oficial de <strong>Caracas, Venezuela (UTC-4)</strong>.</p>",
      "<h3>2. Dinámica de Consignas y Envío de Cuentos</h3>",
      "<p>Durante la etapa de envío de cuentos se publicarán consignas periódicas. Cada participante podrá enviar un (1) cuento en texto plano por consigna, respetando el mínimo y máximo de caracteres (incluidos espacios) establecidos para la edición.</p>",
      "<h3>3. Selección, Edición y Postulación</h3>",
      "<p>Finalizada la recepción de consignas, cada participante activo deberá seleccionar de forma irreversible uno (1) de sus cuentos enviados, pudiendo editar su ortografía, gramática y estilo sin reemplazar la obra original, y confirmar su postulación definitiva.</p>",
      "<h3>4. Votación Anónima y Evaluación del Jurado</h3>",
      "<p>Todos los participantes activos deberán leer las obras postuladas de manera anónima y votar por sus 3 cuentos favoritos (3, 2 y 1 punto). Posteriormente, un Jurado impar evaluará los 10 cuentos más votados (incluyendo empates) para definir a los ganadores del 1er, 2do y 3er lugar.</p>",
    ].join("\n"),
  },
  {
    slug: "quienes-somos",
    title: "¿Quiénes somos? — Club de Escritura SiTeLoCuento",
    contentHtml: [
      "<h2>Sobre el Club de Escritura SiTeLoCuento</h2>",
      "<p><strong>SiTeLoCuento</strong> es una comunidad apasionada por la literatura y la creación narrativa breve. Cada año organizamos las <strong>Olimpíadas Literarias</strong> con el propósito de impulsar el hábito de la escritura constante, el intercambio constructivo entre autores y el descubrimiento de nuevas voces literarias en español.</p>",
      "<h3>Nuestra Misión</h3>",
      "<p>Brindar un espacio transparente, retador y fraterno donde cada consigna sea una chispa creativa y donde la lectura anónima garantice que cada historia brille por su propio mérito.</p>",
    ].join("\n"),
  },
] as const;

/**
 * Determines whether a user email matches the configured initial Superadmin email
 * (case-insensitive and whitespace-trimmed).
 */
export function shouldPromoteToSuperadmin(
  userEmail: string,
  initialSuperadminEmail?: string | null
): boolean {
  if (!initialSuperadminEmail) {
    return false;
  }
  const normalizedUser = userEmail.trim().toLowerCase();
  const normalizedTarget = initialSuperadminEmail.trim().toLowerCase();
  return normalizedUser.length > 0 && normalizedUser === normalizedTarget;
}

export interface SeedExecutionSummary {
  templatesSeeded: number;
  pagesSeeded: number;
  superadminPromoted: boolean;
}

/**
 * Seeds the 26 default email templates (`E01`-`E26`), the 2 static public pages,
 * and promotes `initialSuperadminEmail` to `SUPERADMIN` if that user already exists.
 */
export async function seedInitialData(
  db: AppDatabase,
  options: {
    initialSuperadminEmail?: string;
    nowIso?: string;
  } = {}
): Promise<SeedExecutionSummary> {
  const nowIso = options.nowIso ?? new Date().toISOString();

  for (const tpl of DEFAULT_EMAIL_TEMPLATES) {
    await db
      .insert(emailTemplates)
      .values({
        code: tpl.code,
        name: tpl.name,
        description: tpl.description,
        subjectTemplate: tpl.subjectTemplate,
        bodyHtmlTemplate: tpl.bodyHtmlTemplate,
        availableTagsJson: JSON.stringify(tpl.availableTags),
        updatedAt: nowIso,
      })
      .onConflictDoNothing();
  }

  for (const page of DEFAULT_SITE_PAGES) {
    await db
      .insert(sitePages)
      .values({
        slug: page.slug,
        title: page.title,
        contentHtml: page.contentHtml,
        updatedAt: nowIso,
      })
      .onConflictDoNothing();
  }

  let superadminPromoted = false;
  const targetEmail = options.initialSuperadminEmail?.trim().toLowerCase();
  if (targetEmail) {
    const existingUsers = await db
      .select()
      .from(users)
      .where(eq(users.email, targetEmail));

    if (existingUsers.length > 0) {
      await db
        .update(users)
        .set({ role: "SUPERADMIN", updatedAt: nowIso })
        .where(eq(users.email, targetEmail));
      superadminPromoted = true;
    }
  }

  return {
    templatesSeeded: DEFAULT_EMAIL_TEMPLATES.length,
    pagesSeeded: DEFAULT_SITE_PAGES.length,
    superadminPromoted,
  };
}

function escapeSqlLiteral(val: string): string {
  return `'${val.replace(/'/g, "''")}'`;
}

/**
 * Generates idempotent SQL `INSERT OR IGNORE` / `UPDATE` statements for seeding
 * a Cloudflare D1 database directly via CLI or HTTP query.
 */
export function buildSeedSqlStatements(options: {
  initialSuperadminEmail?: string;
  nowIso?: string;
} = {}): string[] {
  const nowIso = options.nowIso ?? "2026-11-18T00:00:00.000Z";
  const statements: string[] = [];

  for (const tpl of DEFAULT_EMAIL_TEMPLATES) {
    statements.push(
      `INSERT OR IGNORE INTO email_templates (code, name, description, subject_template, body_html_template, available_tags_json, updated_at) VALUES (${escapeSqlLiteral(
        tpl.code
      )}, ${escapeSqlLiteral(tpl.name)}, ${escapeSqlLiteral(
        tpl.description
      )}, ${escapeSqlLiteral(tpl.subjectTemplate)}, ${escapeSqlLiteral(
        tpl.bodyHtmlTemplate
      )}, ${escapeSqlLiteral(
        JSON.stringify(tpl.availableTags)
      )}, ${escapeSqlLiteral(nowIso)});`
    );
  }

  for (const page of DEFAULT_SITE_PAGES) {
    statements.push(
      `INSERT OR IGNORE INTO site_pages (slug, title, content_html, updated_at) VALUES (${escapeSqlLiteral(
        page.slug
      )}, ${escapeSqlLiteral(page.title)}, ${escapeSqlLiteral(
        page.contentHtml
      )}, ${escapeSqlLiteral(nowIso)});`
    );
  }

  const targetEmail = options.initialSuperadminEmail?.trim().toLowerCase();
  if (targetEmail) {
    statements.push(
      `UPDATE users SET role = 'SUPERADMIN', updated_at = ${escapeSqlLiteral(
        nowIso
      )} WHERE lower(email) = ${escapeSqlLiteral(targetEmail)};`
    );
  }

  return statements;
}
