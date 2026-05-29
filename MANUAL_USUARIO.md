# 📘 Manual de Usuario Oficial: Servimeci App

Bienvenido al manual de usuario oficial de **Servimeci App**, el ecosistema digital premium diseñado para optimizar el flujo de trabajo, programación y documentación de proyectos de mantenimiento técnico e infraestructura de Servimeci.

Este documento sirve como guía paso a paso para los diferentes perfiles del sistema: **Administradores, Gerentes y Personal Técnico (Empleados)**.

---

## 🚀 Índice

1. [Introducción y Arquitectura de Roles](#1-introducción-y-arquitectura-de-roles)
2. [Acceso e Inicio de Sesión](#2-acceso-e-inicio-de-sesión)
3. [Módulo de Tablero de Control (Dashboard)](#3-módulo-de-tablero-de-control-dashboard)
4. [Módulo de Programación de Tareas](#4-módulo-de-programación-de-tareas)
5. [Módulo de Planos Técnicos y Diseño](#5-módulo-de-planos-técnicos-y-diseño)
6. [Módulo de Evidencia Técnica y Carpetas](#6-módulo-de-evidencia-técnica-y-carpetas)
7. [Módulo de Gestión de Usuarios y Perfiles](#7-módulo-de-gestión-de-usuarios-y-perfiles)
8. [Mecanismos de Sincronización en Tiempo Real](#8-mecanismos-de-sincronización-en-tiempo-real)
9. [Preguntas Frecuentes y Soporte](#9-preguntas-frecuentes-y-soporte)

---

## 1. Introducción y Arquitectura de Roles

Servimeci App cuenta con una estructura de permisos jerárquica para proteger la integridad de los datos y simplificar la experiencia visual en celulares:

*   **Administrador**: Control total del sistema. Puede crear, modificar y eliminar cualquier tarea, plano, evidencia o cuenta de usuario. Tiene acceso completo a estadísticas globales e históricos.
*   **Gerente**: Responsable de la asignación y planeación regional. Puede crear tareas, evaluar requerimientos técnicos basándose en las certificaciones del personal, y supervisar el avance de las zonas asignadas.
*   **Empleado / Personal Técnico**: Interfaz optimizada y responsiva para celulares. Se enfoca exclusivamente en sus tareas activas. Cuenta con herramientas para reclamar tareas de su área, cronometrar tiempos de trabajo, subir evidencias directamente desde la cámara y escalar tareas cuando sea necesario.

---

## 2. Acceso e Inicio de Sesión

La aplicación utiliza **Clerk** para garantizar un inicio de sesión seguro y ágil.

1.  Ingrese a la URL de la plataforma desde su navegador o abra la aplicación PWA instalada en su celular.
2.  Introduzca sus credenciales asignadas o utilice el sistema de autenticación rápida.
3.  **Registro Automático**: Si es su primera vez iniciando sesión a través de la invitación oficial, el sistema registrará su cuenta en el almacén central asignándole por defecto el rol de **Empleado**, el cual puede ser elevado por un administrador posteriormente.

---

## 3. Módulo de Tablero de Control (Dashboard)

El tablero principal es el centro neurálgico del día a día de Servimeci.

### Flujo de Estados de una Tarea
Las tareas avanzan a través de cuatro columnas dinámicas:
1.  **Por Hacer (Todo)**: Tareas planificadas listas para ser tomadas.
2.  **En Progreso (In Progress)**: Tareas activas que el personal técnico está ejecutando.
3.  **En Revisión (Review)**: Trabajos completados en espera de visto bueno fotográfico o documental por parte de gerencia.
4.  **Completada (Done)**: Trabajos finalizados exitosamente con registro histórico.

### Toma y Control de Tiempos (Técnicos)
*   **Reclamar Tarea**: Al abrir una tarea disponible en tu área, puedes presionar el botón **"Tomar Tarea"** para asignártela automáticamente.
*   **Cronómetro Integrado**: Al iniciar el trabajo, presiona **"Iniciar Tiempo"**. El sistema registrará los minutos y horas invertidos de manera precisa. Puedes pausarlo si requieres ir por materiales y reanudarlo al volver. Esto asegura que la duración acumulada del empleado se guarde de forma permanente en la base de datos de Supabase.

### Escalación de Tareas
Si estás ejecutando un trabajo y encuentras un problema que requiere apoyo de otra área (por ejemplo, una falla de fontanería que necesita un electricista):
1.  Abre la tarea y presiona el botón **"Escalar Tarea"**.
2.  Selecciona el área de destino (Contabilidad, Compras, Proyectos, Operación, etc.) y escribe una nota explicativa.
3.  **Protección de Datos**: Al realizar la escalación, *no perderás tu progreso ni tu historial*. Tu tiempo acumulado y tu nombre quedarán grabados en el historial de la tarea de forma permanente para la rendición de cuentas, mientras que el nuevo técnico podrá reclamarla y sumar su propio tiempo.

---

## 4. Módulo de Programación de Tareas

Diseñado especialmente para Administradores y Gerentes desde computadoras o tabletas.

*   **Filtros Inteligentes**: Permite segmentar las tareas por **Zona/Región** (ej. Zona Norte, Zona Sur, Oficina Central) y **Área** para monitorear cargas de trabajo en segundos.
*   **Asignaciones por Certificación**: Al programar un requerimiento, puedes ver qué técnicos están "Disponibles" o "Libres en 1h", junto con sus certificaciones vigentes (ej. Altura, Espacios Confinados, Arco Eléctrico). Esto garantiza asignar al personal idóneo para cada riesgo.
*   **Exportación a Excel (CSV)**: Con un solo clic en el botón verde **"Exportar Excel"**, puedes descargar el reporte completo de las tareas actuales, tiempos estimados, técnicos asignados e hitos completados.

---

## 5. Módulo de Planos Técnicos y Diseño

Servimeci App cuenta con un **lienzo de diseño digital interactivo integrado** para croquis e indicaciones en sitio.

*   **Edición y Trazado**: Permite dibujar líneas, formas geométricas, ingresar texto técnico y tomar medidas sobre una cuadrícula limpia.
*   **Carga de Planos**: Ideal para subir diagramas unifilares o planos arquitectónicos y realizar anotaciones encima directamente con el dedo (celulares) o el mouse (PC).
*   **Guardado Automático**: Los trazos se sincronizan directamente con el sistema para que cualquier técnico en el sitio visualice las modificaciones.

---

## 6. Módulo de Evidencia Técnica y Carpetas

La documentación visual es clave para certificar la calidad de los servicios de Servimeci.

*   **Subir Multimedia**: Permite adjuntar imágenes, videos tomados en el sitio, notas de voz explicativas y croquis.
*   **Estructura de Carpetas**: Administra tus archivos multimedia mediante carpetas dinámicas organizadas por cliente, fecha o tipo de proyecto para evitar el desorden.
*   **Vinculación de Evidencia**: Toda evidencia subida dentro de la ficha de una tarea se asocia automáticamente a la misma, facilitando las auditorías posteriores del cliente.

---

## 7. Módulo de Gestión de Usuarios y Perfiles

Permite a los administradores mantener al equipo técnico actualizado.

*   **Habilidades e Disponibilidad**: Actualiza el estado de disponibilidad del técnico (Disponible, Libre pronto, Fuera de servicio) y asigna sus destrezas y certificaciones correspondientes.
*   **Gestión de Áreas**: Configura a qué áreas pertenece cada usuario para recibir notificaciones inteligentes únicamente de los proyectos que le corresponden.

---

## 8. Mecanismos de Sincronización en Tiempo Real

Para evitar conflictos de escritura concurrente y asegurar la máxima velocidad, Servimeci App implementa tres métodos de actualización en tiempo real:

1.  **Sincronización al Entrar a una Tarea**: Cada vez que abres el modal de detalles de cualquier tarea, la aplicación realiza un fetch rápido en segundo plano para traerte la información y tiempos más recientes de Supabase.
2.  **Sincronización por Menú**: Al moverte entre las pestañas del menú inferior en celulares o el menú lateral en PC, la aplicación se actualiza de manera silenciosa y segura.
3.  **Gesto Deslizar para Actualizar (Pull-to-Refresh) 📱**: En celulares, simplemente arrastra la pantalla hacia abajo desde la parte superior. Verás un elegante indicador circular girando en tiempo real que recargará toda la base de datos de inmediato.
4.  **Botón de Sincronización Manual 🔄**: Ubicado en la cabecera superior (tanto en PC como celulares), un icono de flechas circulares que al ser presionado gira activamente y actualiza todos los datos del tablero en un segundo.

---

## 9. Preguntas Frecuentes y Soporte

#### ¿Por qué no puedo ver todos los menús en mi celular?
Si tu rol es **Empleado**, tu menú estará simplificado y optimizado con las opciones de **Tablero** y **Tareas** para facilitar la usabilidad en pantallas pequeñas y evitar distracciones. Los menús de configuración global, usuarios y estadísticas están reservados para Gerentes y Administradores.

#### ¿Qué pasa si cierro la aplicación sin pausar el cronómetro de una tarea?
El sistema registra la hora exacta de inicio en la base de datos de Supabase. El tiempo continuará acumulándose de manera segura y correcta incluso si tu teléfono se apaga o cierras el navegador. Al volver a abrir la tarea, verás el tiempo real transcurrido.

#### ¿Cómo instalo Servimeci App en mi pantalla de inicio?
En la barra lateral o en el encabezado móvil, presiona el botón **"Instalar App"** para agregar Servimeci como una PWA (Progressive Web App) nativa. Esto te dará acceso directo sin escribir la URL y mejorará el rendimiento general.

---

*Servimeci App — Calidad, Control y Eficiencia Técnica en tus manos.*
