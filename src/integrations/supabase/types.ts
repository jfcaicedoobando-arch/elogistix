export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      alertas_sistema: {
        Row: {
          acknowledged_at: string | null
          acknowledged_by: string | null
          created_at: string
          dedupe_key: string | null
          id: string
          message: string
          payload: Json | null
          severity: string
          source: string
        }
        Insert: {
          acknowledged_at?: string | null
          acknowledged_by?: string | null
          created_at?: string
          dedupe_key?: string | null
          id?: string
          message: string
          payload?: Json | null
          severity?: string
          source: string
        }
        Update: {
          acknowledged_at?: string | null
          acknowledged_by?: string | null
          created_at?: string
          dedupe_key?: string | null
          id?: string
          message?: string
          payload?: Json | null
          severity?: string
          source?: string
        }
        Relationships: []
      }
      app_logs: {
        Row: {
          fn: string
          id: string
          latency_ms: number | null
          level: string
          msg: string
          organization_id: string | null
          payload: Json | null
          request_id: string | null
          status_code: number | null
          ts: string
          user_id: string | null
        }
        Insert: {
          fn: string
          id?: string
          latency_ms?: number | null
          level: string
          msg: string
          organization_id?: string | null
          payload?: Json | null
          request_id?: string | null
          status_code?: number | null
          ts?: string
          user_id?: string | null
        }
        Update: {
          fn?: string
          id?: string
          latency_ms?: number | null
          level?: string
          msg?: string
          organization_id?: string | null
          payload?: Json | null
          request_id?: string | null
          status_code?: number | null
          ts?: string
          user_id?: string | null
        }
        Relationships: []
      }
      auditoria_comentarios: {
        Row: {
          autor_email: string
          autor_id: string
          contenido: string
          created_at: string
          id: string
          organization_id: string
          revision_id: string
        }
        Insert: {
          autor_email?: string
          autor_id: string
          contenido: string
          created_at?: string
          id?: string
          organization_id?: string
          revision_id: string
        }
        Update: {
          autor_email?: string
          autor_id?: string
          contenido?: string
          created_at?: string
          id?: string
          organization_id?: string
          revision_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "auditoria_comentarios_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "auditoria_comentarios_revision_id_fkey"
            columns: ["revision_id"]
            isOneToOne: false
            referencedRelation: "auditoria_revisiones"
            referencedColumns: ["id"]
          },
        ]
      }
      auditoria_revisiones: {
        Row: {
          accion_tomada: string | null
          asignado_at: string | null
          asignado_por: string | null
          asignado_por_email: string
          created_at: string
          detalle: string
          detalle_hash: string
          embarque_id: string
          estado_revision: Database["public"]["Enums"]["estado_hallazgo_revision"]
          fecha_limite: string | null
          id: string
          organization_id: string
          regla: string
          responsable_email: string
          responsable_id: string | null
          revisado_por: string | null
          revisado_por_email: string | null
          snooze_motivo: string | null
          snoozed_until: string | null
          updated_at: string
        }
        Insert: {
          accion_tomada?: string | null
          asignado_at?: string | null
          asignado_por?: string | null
          asignado_por_email?: string
          created_at?: string
          detalle?: string
          detalle_hash: string
          embarque_id: string
          estado_revision?: Database["public"]["Enums"]["estado_hallazgo_revision"]
          fecha_limite?: string | null
          id?: string
          organization_id?: string
          regla: string
          responsable_email?: string
          responsable_id?: string | null
          revisado_por?: string | null
          revisado_por_email?: string | null
          snooze_motivo?: string | null
          snoozed_until?: string | null
          updated_at?: string
        }
        Update: {
          accion_tomada?: string | null
          asignado_at?: string | null
          asignado_por?: string | null
          asignado_por_email?: string
          created_at?: string
          detalle?: string
          detalle_hash?: string
          embarque_id?: string
          estado_revision?: Database["public"]["Enums"]["estado_hallazgo_revision"]
          fecha_limite?: string | null
          id?: string
          organization_id?: string
          regla?: string
          responsable_email?: string
          responsable_id?: string | null
          revisado_por?: string | null
          revisado_por_email?: string | null
          snooze_motivo?: string | null
          snoozed_until?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "auditoria_revisiones_embarque_id_fkey"
            columns: ["embarque_id"]
            isOneToOne: false
            referencedRelation: "embarques"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "auditoria_revisiones_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      auditoria_snapshots: {
        Row: {
          altos: number
          created_at: string
          criticos: number
          fecha: string
          id: string
          medios: number
          organization_id: string
          por_regla: Json
          score: number
          total_hallazgos: number
          total_pendientes: number
        }
        Insert: {
          altos?: number
          created_at?: string
          criticos?: number
          fecha?: string
          id?: string
          medios?: number
          organization_id: string
          por_regla?: Json
          score?: number
          total_hallazgos?: number
          total_pendientes?: number
        }
        Update: {
          altos?: number
          created_at?: string
          criticos?: number
          fecha?: string
          id?: string
          medios?: number
          organization_id?: string
          por_regla?: Json
          score?: number
          total_hallazgos?: number
          total_pendientes?: number
        }
        Relationships: []
      }
      bitacora_actividad: {
        Row: {
          accion: string
          created_at: string
          detalles: Json | null
          entidad_id: string | null
          entidad_nombre: string | null
          id: string
          modulo: string
          organization_id: string | null
          usuario_email: string
          usuario_id: string
        }
        Insert: {
          accion: string
          created_at?: string
          detalles?: Json | null
          entidad_id?: string | null
          entidad_nombre?: string | null
          id?: string
          modulo: string
          organization_id?: string | null
          usuario_email?: string
          usuario_id: string
        }
        Update: {
          accion?: string
          created_at?: string
          detalles?: Json | null
          entidad_id?: string | null
          entidad_nombre?: string | null
          id?: string
          modulo?: string
          organization_id?: string | null
          usuario_email?: string
          usuario_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "bitacora_actividad_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      client_users: {
        Row: {
          cliente_id: string
          created_at: string | null
          id: string
          organization_id: string
          user_id: string
        }
        Insert: {
          cliente_id: string
          created_at?: string | null
          id?: string
          organization_id: string
          user_id: string
        }
        Update: {
          cliente_id?: string
          created_at?: string | null
          id?: string
          organization_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_users_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_users_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      clientes: {
        Row: {
          ciudad: string
          contacto: string
          cp: string
          created_at: string
          deleted_at: string | null
          deleted_by: string | null
          dias_credito: number | null
          direccion: string
          email: string
          estado: string
          id: string
          nombre: string
          organization_id: string
          rfc: string
          telefono: string
          updated_at: string
        }
        Insert: {
          ciudad?: string
          contacto?: string
          cp?: string
          created_at?: string
          deleted_at?: string | null
          deleted_by?: string | null
          dias_credito?: number | null
          direccion?: string
          email?: string
          estado?: string
          id?: string
          nombre: string
          organization_id?: string
          rfc?: string
          telefono?: string
          updated_at?: string
        }
        Update: {
          ciudad?: string
          contacto?: string
          cp?: string
          created_at?: string
          deleted_at?: string | null
          deleted_by?: string | null
          dias_credito?: number | null
          direccion?: string
          email?: string
          estado?: string
          id?: string
          nombre?: string
          organization_id?: string
          rfc?: string
          telefono?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "clientes_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      conceptos_costo: {
        Row: {
          concepto: string
          contenedor_id: string | null
          created_at: string
          deleted_at: string | null
          deleted_by: string | null
          embarque_id: string
          estado_liquidacion: Database["public"]["Enums"]["estado_liquidacion"]
          fecha_pago: string | null
          fecha_vencimiento: string | null
          id: string
          moneda: Database["public"]["Enums"]["moneda"]
          monto: number
          organization_id: string
          proveedor_id: string | null
          proveedor_nombre: string
          referencia_pago: string | null
        }
        Insert: {
          concepto: string
          contenedor_id?: string | null
          created_at?: string
          deleted_at?: string | null
          deleted_by?: string | null
          embarque_id: string
          estado_liquidacion?: Database["public"]["Enums"]["estado_liquidacion"]
          fecha_pago?: string | null
          fecha_vencimiento?: string | null
          id?: string
          moneda?: Database["public"]["Enums"]["moneda"]
          monto?: number
          organization_id?: string
          proveedor_id?: string | null
          proveedor_nombre?: string
          referencia_pago?: string | null
        }
        Update: {
          concepto?: string
          contenedor_id?: string | null
          created_at?: string
          deleted_at?: string | null
          deleted_by?: string | null
          embarque_id?: string
          estado_liquidacion?: Database["public"]["Enums"]["estado_liquidacion"]
          fecha_pago?: string | null
          fecha_vencimiento?: string | null
          id?: string
          moneda?: Database["public"]["Enums"]["moneda"]
          monto?: number
          organization_id?: string
          proveedor_id?: string | null
          proveedor_nombre?: string
          referencia_pago?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "conceptos_costo_contenedor_id_fkey"
            columns: ["contenedor_id"]
            isOneToOne: false
            referencedRelation: "embarque_contenedores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conceptos_costo_embarque_id_fkey"
            columns: ["embarque_id"]
            isOneToOne: false
            referencedRelation: "embarques"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conceptos_costo_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conceptos_costo_proveedor_id_fkey"
            columns: ["proveedor_id"]
            isOneToOne: false
            referencedRelation: "proveedores"
            referencedColumns: ["id"]
          },
        ]
      }
      conceptos_factura: {
        Row: {
          cantidad: number
          created_at: string
          deleted_at: string | null
          deleted_by: string | null
          descripcion: string
          factura_id: string
          id: string
          moneda: Database["public"]["Enums"]["moneda"]
          organization_id: string
          precio_unitario: number
          total: number
        }
        Insert: {
          cantidad?: number
          created_at?: string
          deleted_at?: string | null
          deleted_by?: string | null
          descripcion: string
          factura_id: string
          id?: string
          moneda?: Database["public"]["Enums"]["moneda"]
          organization_id?: string
          precio_unitario?: number
          total?: number
        }
        Update: {
          cantidad?: number
          created_at?: string
          deleted_at?: string | null
          deleted_by?: string | null
          descripcion?: string
          factura_id?: string
          id?: string
          moneda?: Database["public"]["Enums"]["moneda"]
          organization_id?: string
          precio_unitario?: number
          total?: number
        }
        Relationships: [
          {
            foreignKeyName: "conceptos_factura_factura_id_fkey"
            columns: ["factura_id"]
            isOneToOne: false
            referencedRelation: "facturas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conceptos_factura_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      conceptos_venta: {
        Row: {
          aplica_iva: boolean
          cantidad: number
          contenedor_id: string | null
          created_at: string
          deleted_at: string | null
          deleted_by: string | null
          descripcion: string
          embarque_id: string
          estado_facturacion: string
          id: string
          moneda: Database["public"]["Enums"]["moneda"]
          organization_id: string
          precio_unitario: number
          proforma_id: string | null
          total: number
        }
        Insert: {
          aplica_iva?: boolean
          cantidad?: number
          contenedor_id?: string | null
          created_at?: string
          deleted_at?: string | null
          deleted_by?: string | null
          descripcion: string
          embarque_id: string
          estado_facturacion?: string
          id?: string
          moneda?: Database["public"]["Enums"]["moneda"]
          organization_id?: string
          precio_unitario?: number
          proforma_id?: string | null
          total?: number
        }
        Update: {
          aplica_iva?: boolean
          cantidad?: number
          contenedor_id?: string | null
          created_at?: string
          deleted_at?: string | null
          deleted_by?: string | null
          descripcion?: string
          embarque_id?: string
          estado_facturacion?: string
          id?: string
          moneda?: Database["public"]["Enums"]["moneda"]
          organization_id?: string
          precio_unitario?: number
          proforma_id?: string | null
          total?: number
        }
        Relationships: [
          {
            foreignKeyName: "conceptos_venta_contenedor_id_fkey"
            columns: ["contenedor_id"]
            isOneToOne: false
            referencedRelation: "embarque_contenedores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conceptos_venta_embarque_id_fkey"
            columns: ["embarque_id"]
            isOneToOne: false
            referencedRelation: "embarques"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conceptos_venta_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conceptos_venta_proforma_id_fkey"
            columns: ["proforma_id"]
            isOneToOne: false
            referencedRelation: "proformas"
            referencedColumns: ["id"]
          },
        ]
      }
      configuracion: {
        Row: {
          categoria: string
          clave: string
          created_at: string
          descripcion: string
          id: string
          organization_id: string
          updated_at: string
          valor: Json
        }
        Insert: {
          categoria: string
          clave: string
          created_at?: string
          descripcion?: string
          id?: string
          organization_id?: string
          updated_at?: string
          valor?: Json
        }
        Update: {
          categoria?: string
          clave?: string
          created_at?: string
          descripcion?: string
          id?: string
          organization_id?: string
          updated_at?: string
          valor?: Json
        }
        Relationships: [
          {
            foreignKeyName: "configuracion_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      configuracion_global: {
        Row: {
          categoria: string
          clave: string
          created_at: string | null
          descripcion: string
          id: string
          updated_at: string | null
          valor: Json
        }
        Insert: {
          categoria: string
          clave: string
          created_at?: string | null
          descripcion?: string
          id?: string
          updated_at?: string | null
          valor?: Json
        }
        Update: {
          categoria?: string
          clave?: string
          created_at?: string | null
          descripcion?: string
          id?: string
          updated_at?: string | null
          valor?: Json
        }
        Relationships: []
      }
      contactos_cliente: {
        Row: {
          ciudad: string
          cliente_id: string
          contacto: string
          created_at: string
          deleted_at: string | null
          deleted_by: string | null
          direccion: string
          email: string
          id: string
          nombre: string
          organization_id: string
          pais: string
          rfc: string
          telefono: string
          tipo: Database["public"]["Enums"]["tipo_contacto"]
        }
        Insert: {
          ciudad?: string
          cliente_id: string
          contacto?: string
          created_at?: string
          deleted_at?: string | null
          deleted_by?: string | null
          direccion?: string
          email?: string
          id?: string
          nombre: string
          organization_id?: string
          pais?: string
          rfc?: string
          telefono?: string
          tipo?: Database["public"]["Enums"]["tipo_contacto"]
        }
        Update: {
          ciudad?: string
          cliente_id?: string
          contacto?: string
          created_at?: string
          deleted_at?: string | null
          deleted_by?: string | null
          direccion?: string
          email?: string
          id?: string
          nombre?: string
          organization_id?: string
          pais?: string
          rfc?: string
          telefono?: string
          tipo?: Database["public"]["Enums"]["tipo_contacto"]
        }
        Relationships: [
          {
            foreignKeyName: "contactos_cliente_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contactos_cliente_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      cotizacion_costos: {
        Row: {
          cantidad: number
          concepto: string
          costo_total: number | null
          costo_unitario: number
          cotizacion_id: string
          created_at: string | null
          deleted_at: string | null
          deleted_by: string | null
          id: string
          moneda: string
          notas: string
          organization_id: string
          porcentaje_profit: number | null
          precio_total: number | null
          precio_venta: number
          profit: number | null
          proveedor: string
          unidad_medida: string
          updated_at: string | null
        }
        Insert: {
          cantidad?: number
          concepto: string
          costo_total?: number | null
          costo_unitario?: number
          cotizacion_id: string
          created_at?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          id?: string
          moneda: string
          notas?: string
          organization_id?: string
          porcentaje_profit?: number | null
          precio_total?: number | null
          precio_venta?: number
          profit?: number | null
          proveedor?: string
          unidad_medida?: string
          updated_at?: string | null
        }
        Update: {
          cantidad?: number
          concepto?: string
          costo_total?: number | null
          costo_unitario?: number
          cotizacion_id?: string
          created_at?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          id?: string
          moneda?: string
          notas?: string
          organization_id?: string
          porcentaje_profit?: number | null
          precio_total?: number | null
          precio_venta?: number
          profit?: number | null
          proveedor?: string
          unidad_medida?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "cotizacion_costos_cotizacion_id_fkey"
            columns: ["cotizacion_id"]
            isOneToOne: false
            referencedRelation: "cotizaciones"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cotizacion_costos_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      cotizaciones: {
        Row: {
          carta_garantia: boolean
          cliente_id: string | null
          cliente_nombre: string
          comentario_cliente: string | null
          conceptos_venta: Json
          created_at: string
          deleted_at: string | null
          deleted_by: string | null
          descripcion_adicional: string
          descripcion_mercancia: string
          destino: string
          dias_almacenaje: number
          dias_libres_destino: number
          dimensiones_aereas: Json
          dimensiones_lcl: Json
          embarque_id: string | null
          es_prospecto: boolean
          estado: Database["public"]["Enums"]["estado_cotizacion"]
          fecha_aceptacion: string | null
          fecha_rechazo: string | null
          fecha_vigencia: string | null
          folio: string
          frecuencia: string
          id: string
          incoterm: Database["public"]["Enums"]["incoterm"]
          modo: Database["public"]["Enums"]["modo_transporte"]
          moneda: Database["public"]["Enums"]["moneda"]
          msds_archivo: string | null
          notas: string | null
          num_contenedores: number
          operador: string
          oportunidad_id: string | null
          organization_id: string
          origen: string
          peso_kg: number
          piezas: number
          prospecto_contacto: string
          prospecto_email: string
          prospecto_empresa: string
          prospecto_telefono: string
          ruta_texto: string
          sector_economico: string
          seguro: boolean
          subtotal: number
          tiempo_transito_dias: number | null
          tipo: Database["public"]["Enums"]["tipo_operacion"]
          tipo_carga: string
          tipo_contenedor: string | null
          tipo_embarque: string
          tipo_movimiento: string
          tipo_peso: string
          tipo_unidad: string | null
          updated_at: string
          validez_propuesta: string | null
          valor_seguro_usd: number
          vigencia_dias: number
          volumen_m3: number
        }
        Insert: {
          carta_garantia?: boolean
          cliente_id?: string | null
          cliente_nombre?: string
          comentario_cliente?: string | null
          conceptos_venta?: Json
          created_at?: string
          deleted_at?: string | null
          deleted_by?: string | null
          descripcion_adicional?: string
          descripcion_mercancia?: string
          destino?: string
          dias_almacenaje?: number
          dias_libres_destino?: number
          dimensiones_aereas?: Json
          dimensiones_lcl?: Json
          embarque_id?: string | null
          es_prospecto?: boolean
          estado?: Database["public"]["Enums"]["estado_cotizacion"]
          fecha_aceptacion?: string | null
          fecha_rechazo?: string | null
          fecha_vigencia?: string | null
          folio: string
          frecuencia?: string
          id?: string
          incoterm?: Database["public"]["Enums"]["incoterm"]
          modo: Database["public"]["Enums"]["modo_transporte"]
          moneda?: Database["public"]["Enums"]["moneda"]
          msds_archivo?: string | null
          notas?: string | null
          num_contenedores?: number
          operador?: string
          oportunidad_id?: string | null
          organization_id?: string
          origen?: string
          peso_kg?: number
          piezas?: number
          prospecto_contacto?: string
          prospecto_email?: string
          prospecto_empresa?: string
          prospecto_telefono?: string
          ruta_texto?: string
          sector_economico?: string
          seguro?: boolean
          subtotal?: number
          tiempo_transito_dias?: number | null
          tipo: Database["public"]["Enums"]["tipo_operacion"]
          tipo_carga?: string
          tipo_contenedor?: string | null
          tipo_embarque?: string
          tipo_movimiento?: string
          tipo_peso?: string
          tipo_unidad?: string | null
          updated_at?: string
          validez_propuesta?: string | null
          valor_seguro_usd?: number
          vigencia_dias?: number
          volumen_m3?: number
        }
        Update: {
          carta_garantia?: boolean
          cliente_id?: string | null
          cliente_nombre?: string
          comentario_cliente?: string | null
          conceptos_venta?: Json
          created_at?: string
          deleted_at?: string | null
          deleted_by?: string | null
          descripcion_adicional?: string
          descripcion_mercancia?: string
          destino?: string
          dias_almacenaje?: number
          dias_libres_destino?: number
          dimensiones_aereas?: Json
          dimensiones_lcl?: Json
          embarque_id?: string | null
          es_prospecto?: boolean
          estado?: Database["public"]["Enums"]["estado_cotizacion"]
          fecha_aceptacion?: string | null
          fecha_rechazo?: string | null
          fecha_vigencia?: string | null
          folio?: string
          frecuencia?: string
          id?: string
          incoterm?: Database["public"]["Enums"]["incoterm"]
          modo?: Database["public"]["Enums"]["modo_transporte"]
          moneda?: Database["public"]["Enums"]["moneda"]
          msds_archivo?: string | null
          notas?: string | null
          num_contenedores?: number
          operador?: string
          oportunidad_id?: string | null
          organization_id?: string
          origen?: string
          peso_kg?: number
          piezas?: number
          prospecto_contacto?: string
          prospecto_email?: string
          prospecto_empresa?: string
          prospecto_telefono?: string
          ruta_texto?: string
          sector_economico?: string
          seguro?: boolean
          subtotal?: number
          tiempo_transito_dias?: number | null
          tipo?: Database["public"]["Enums"]["tipo_operacion"]
          tipo_carga?: string
          tipo_contenedor?: string | null
          tipo_embarque?: string
          tipo_movimiento?: string
          tipo_peso?: string
          tipo_unidad?: string | null
          updated_at?: string
          validez_propuesta?: string | null
          valor_seguro_usd?: number
          vigencia_dias?: number
          volumen_m3?: number
        }
        Relationships: [
          {
            foreignKeyName: "cotizaciones_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cotizaciones_embarque_id_fkey"
            columns: ["embarque_id"]
            isOneToOne: false
            referencedRelation: "embarques"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cotizaciones_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_actividades: {
        Row: {
          asunto: string
          created_at: string
          created_by: string | null
          deleted_at: string | null
          deleted_by: string | null
          descripcion: string
          duracion_min: number | null
          entidad_id: string
          entidad_tipo: Database["public"]["Enums"]["crm_entidad_tipo"]
          fecha_completada: string | null
          fecha_programada: string | null
          id: string
          organization_id: string
          responsable_email: string
          responsable_id: string | null
          resultado: string
          tipo: Database["public"]["Enums"]["crm_actividad_tipo"]
          updated_at: string
        }
        Insert: {
          asunto: string
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          descripcion?: string
          duracion_min?: number | null
          entidad_id: string
          entidad_tipo: Database["public"]["Enums"]["crm_entidad_tipo"]
          fecha_completada?: string | null
          fecha_programada?: string | null
          id?: string
          organization_id?: string
          responsable_email?: string
          responsable_id?: string | null
          resultado?: string
          tipo: Database["public"]["Enums"]["crm_actividad_tipo"]
          updated_at?: string
        }
        Update: {
          asunto?: string
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          descripcion?: string
          duracion_min?: number | null
          entidad_id?: string
          entidad_tipo?: Database["public"]["Enums"]["crm_entidad_tipo"]
          fecha_completada?: string | null
          fecha_programada?: string | null
          id?: string
          organization_id?: string
          responsable_email?: string
          responsable_id?: string | null
          resultado?: string
          tipo?: Database["public"]["Enums"]["crm_actividad_tipo"]
          updated_at?: string
        }
        Relationships: []
      }
      crm_comentarios_oportunidad: {
        Row: {
          autor_email: string
          autor_id: string
          created_at: string
          deleted_at: string | null
          deleted_by: string | null
          id: string
          oportunidad_id: string
          organization_id: string
          texto: string
          updated_at: string
        }
        Insert: {
          autor_email?: string
          autor_id: string
          created_at?: string
          deleted_at?: string | null
          deleted_by?: string | null
          id?: string
          oportunidad_id: string
          organization_id?: string
          texto: string
          updated_at?: string
        }
        Update: {
          autor_email?: string
          autor_id?: string
          created_at?: string
          deleted_at?: string | null
          deleted_by?: string | null
          id?: string
          oportunidad_id?: string
          organization_id?: string
          texto?: string
          updated_at?: string
        }
        Relationships: []
      }
      crm_cuotas_vendedor: {
        Row: {
          anio: number
          created_at: string
          cuota_monto: number
          id: string
          mes: number
          moneda: string
          organization_id: string
          updated_at: string
          vendedor_email: string
          vendedor_id: string
        }
        Insert: {
          anio: number
          created_at?: string
          cuota_monto?: number
          id?: string
          mes: number
          moneda?: string
          organization_id?: string
          updated_at?: string
          vendedor_email?: string
          vendedor_id: string
        }
        Update: {
          anio?: number
          created_at?: string
          cuota_monto?: number
          id?: string
          mes?: number
          moneda?: string
          organization_id?: string
          updated_at?: string
          vendedor_email?: string
          vendedor_id?: string
        }
        Relationships: []
      }
      crm_etapas_pipeline: {
        Row: {
          activa: boolean
          color: string
          crea_tarea_seguimiento: boolean
          created_at: string
          deleted_at: string | null
          deleted_by: string | null
          dias_seguimiento: number
          id: string
          nombre: string
          orden: number
          organization_id: string
          probabilidad_default: number
          tipo: Database["public"]["Enums"]["crm_etapa_tipo"]
          updated_at: string
        }
        Insert: {
          activa?: boolean
          color?: string
          crea_tarea_seguimiento?: boolean
          created_at?: string
          deleted_at?: string | null
          deleted_by?: string | null
          dias_seguimiento?: number
          id?: string
          nombre: string
          orden?: number
          organization_id?: string
          probabilidad_default?: number
          tipo?: Database["public"]["Enums"]["crm_etapa_tipo"]
          updated_at?: string
        }
        Update: {
          activa?: boolean
          color?: string
          crea_tarea_seguimiento?: boolean
          created_at?: string
          deleted_at?: string | null
          deleted_by?: string | null
          dias_seguimiento?: number
          id?: string
          nombre?: string
          orden?: number
          organization_id?: string
          probabilidad_default?: number
          tipo?: Database["public"]["Enums"]["crm_etapa_tipo"]
          updated_at?: string
        }
        Relationships: []
      }
      crm_leads: {
        Row: {
          ciudad: string
          cliente_convertido_id: string | null
          contacto: string
          created_at: string
          created_by: string | null
          deleted_at: string | null
          deleted_by: string | null
          email: string
          empresa: string
          estado: Database["public"]["Enums"]["crm_lead_estado"]
          fuente: Database["public"]["Enums"]["crm_lead_fuente"]
          id: string
          interes_modo: string
          notas: string
          oportunidad_convertida_id: string | null
          organization_id: string
          pais: string
          score: number
          telefono: string
          updated_at: string
          vendedor_email: string
          vendedor_id: string | null
        }
        Insert: {
          ciudad?: string
          cliente_convertido_id?: string | null
          contacto?: string
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          email?: string
          empresa: string
          estado?: Database["public"]["Enums"]["crm_lead_estado"]
          fuente?: Database["public"]["Enums"]["crm_lead_fuente"]
          id?: string
          interes_modo?: string
          notas?: string
          oportunidad_convertida_id?: string | null
          organization_id?: string
          pais?: string
          score?: number
          telefono?: string
          updated_at?: string
          vendedor_email?: string
          vendedor_id?: string | null
        }
        Update: {
          ciudad?: string
          cliente_convertido_id?: string | null
          contacto?: string
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          email?: string
          empresa?: string
          estado?: Database["public"]["Enums"]["crm_lead_estado"]
          fuente?: Database["public"]["Enums"]["crm_lead_fuente"]
          id?: string
          interes_modo?: string
          notas?: string
          oportunidad_convertida_id?: string | null
          organization_id?: string
          pais?: string
          score?: number
          telefono?: string
          updated_at?: string
          vendedor_email?: string
          vendedor_id?: string | null
        }
        Relationships: []
      }
      crm_motivos_perdida: {
        Row: {
          activa: boolean
          created_at: string
          deleted_at: string | null
          deleted_by: string | null
          id: string
          nombre: string
          organization_id: string
        }
        Insert: {
          activa?: boolean
          created_at?: string
          deleted_at?: string | null
          deleted_by?: string | null
          id?: string
          nombre: string
          organization_id?: string
        }
        Update: {
          activa?: boolean
          created_at?: string
          deleted_at?: string | null
          deleted_by?: string | null
          id?: string
          nombre?: string
          organization_id?: string
        }
        Relationships: []
      }
      crm_notificaciones: {
        Row: {
          created_at: string
          id: string
          leida_at: string | null
          link: string | null
          mensaje: string
          organization_id: string
          tipo: string
          titulo: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          leida_at?: string | null
          link?: string | null
          mensaje?: string
          organization_id?: string
          tipo: string
          titulo: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          leida_at?: string | null
          link?: string | null
          mensaje?: string
          organization_id?: string
          tipo?: string
          titulo?: string
          user_id?: string
        }
        Relationships: []
      }
      crm_oportunidades: {
        Row: {
          cliente_id: string | null
          cliente_nombre: string
          cotizacion_ganadora_id: string | null
          created_at: string
          created_by: string | null
          deleted_at: string | null
          deleted_by: string | null
          destino: string
          embarque_ganador_id: string | null
          etapa_id: string
          fecha_cierre_real: string | null
          fecha_estimada_cierre: string | null
          id: string
          lead_id: string | null
          modo: string
          moneda: string
          monto_estimado: number
          motivo_perdida_id: string | null
          nombre: string
          notas: string
          organization_id: string
          origen: string
          probabilidad: number
          tipo_carga: string
          updated_at: string
          valor_real: number | null
          vendedor_email: string
          vendedor_id: string | null
        }
        Insert: {
          cliente_id?: string | null
          cliente_nombre?: string
          cotizacion_ganadora_id?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          destino?: string
          embarque_ganador_id?: string | null
          etapa_id: string
          fecha_cierre_real?: string | null
          fecha_estimada_cierre?: string | null
          id?: string
          lead_id?: string | null
          modo?: string
          moneda?: string
          monto_estimado?: number
          motivo_perdida_id?: string | null
          nombre: string
          notas?: string
          organization_id?: string
          origen?: string
          probabilidad?: number
          tipo_carga?: string
          updated_at?: string
          valor_real?: number | null
          vendedor_email?: string
          vendedor_id?: string | null
        }
        Update: {
          cliente_id?: string | null
          cliente_nombre?: string
          cotizacion_ganadora_id?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          destino?: string
          embarque_ganador_id?: string | null
          etapa_id?: string
          fecha_cierre_real?: string | null
          fecha_estimada_cierre?: string | null
          id?: string
          lead_id?: string | null
          modo?: string
          moneda?: string
          monto_estimado?: number
          motivo_perdida_id?: string | null
          nombre?: string
          notas?: string
          organization_id?: string
          origen?: string
          probabilidad?: number
          tipo_carga?: string
          updated_at?: string
          valor_real?: number | null
          vendedor_email?: string
          vendedor_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "crm_oportunidades_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_oportunidades_etapa_id_fkey"
            columns: ["etapa_id"]
            isOneToOne: false
            referencedRelation: "crm_etapas_pipeline"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_oportunidades_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "crm_leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_oportunidades_motivo_perdida_id_fkey"
            columns: ["motivo_perdida_id"]
            isOneToOne: false
            referencedRelation: "crm_motivos_perdida"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_plantillas_mensaje: {
        Row: {
          activa: boolean
          asunto: string
          canal: string
          created_at: string
          cuerpo: string
          deleted_at: string | null
          deleted_by: string | null
          id: string
          nombre: string
          organization_id: string
          updated_at: string
        }
        Insert: {
          activa?: boolean
          asunto?: string
          canal: string
          created_at?: string
          cuerpo?: string
          deleted_at?: string | null
          deleted_by?: string | null
          id?: string
          nombre: string
          organization_id?: string
          updated_at?: string
        }
        Update: {
          activa?: boolean
          asunto?: string
          canal?: string
          created_at?: string
          cuerpo?: string
          deleted_at?: string | null
          deleted_by?: string | null
          id?: string
          nombre?: string
          organization_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      documentos_embarque: {
        Row: {
          archivo: string | null
          created_at: string
          deleted_at: string | null
          deleted_by: string | null
          embarque_id: string
          estado: Database["public"]["Enums"]["estado_documento"]
          id: string
          nombre: string
          notas: string | null
          organization_id: string
        }
        Insert: {
          archivo?: string | null
          created_at?: string
          deleted_at?: string | null
          deleted_by?: string | null
          embarque_id: string
          estado?: Database["public"]["Enums"]["estado_documento"]
          id?: string
          nombre: string
          notas?: string | null
          organization_id?: string
        }
        Update: {
          archivo?: string | null
          created_at?: string
          deleted_at?: string | null
          deleted_by?: string | null
          embarque_id?: string
          estado?: Database["public"]["Enums"]["estado_documento"]
          id?: string
          nombre?: string
          notas?: string | null
          organization_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "documentos_embarque_embarque_id_fkey"
            columns: ["embarque_id"]
            isOneToOne: false
            referencedRelation: "embarques"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documentos_embarque_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      embarque_contenedores: {
        Row: {
          bl_house: string
          created_at: string
          deleted_at: string | null
          deleted_by: string | null
          embarque_id: string
          id: string
          numero_contenedor: string
          orden: number
          organization_id: string
          peso_kg: number
          piezas: number
          tipo_contenedor: string
          updated_at: string
          volumen_m3: number
        }
        Insert: {
          bl_house?: string
          created_at?: string
          deleted_at?: string | null
          deleted_by?: string | null
          embarque_id: string
          id?: string
          numero_contenedor?: string
          orden?: number
          organization_id?: string
          peso_kg?: number
          piezas?: number
          tipo_contenedor?: string
          updated_at?: string
          volumen_m3?: number
        }
        Update: {
          bl_house?: string
          created_at?: string
          deleted_at?: string | null
          deleted_by?: string | null
          embarque_id?: string
          id?: string
          numero_contenedor?: string
          orden?: number
          organization_id?: string
          peso_kg?: number
          piezas?: number
          tipo_contenedor?: string
          updated_at?: string
          volumen_m3?: number
        }
        Relationships: [
          {
            foreignKeyName: "embarque_contenedores_embarque_id_fkey"
            columns: ["embarque_id"]
            isOneToOne: false
            referencedRelation: "embarques"
            referencedColumns: ["id"]
          },
        ]
      }
      embarques: {
        Row: {
          aerolinea: string | null
          aeropuerto_destino: string | null
          aeropuerto_origen: string | null
          agente: string | null
          bl_house: string | null
          bl_master: string | null
          carta_porte: string | null
          ciudad_destino: string | null
          ciudad_origen: string | null
          cliente_id: string
          cliente_nombre: string
          consignatario: string
          contenedor: string | null
          cotizacion_id: string | null
          created_at: string
          created_by: string | null
          created_by_email: string | null
          deleted_at: string | null
          deleted_by: string | null
          descripcion_mercancia: string
          estado: Database["public"]["Enums"]["estado_embarque"]
          eta: string | null
          eta_original: string | null
          etd: string | null
          etd_original: string | null
          expediente: string
          fecha_creacion: string
          fecha_llegada_real: string | null
          hawb: string | null
          id: string
          incoterm: Database["public"]["Enums"]["incoterm"]
          mawb: string | null
          modo: Database["public"]["Enums"]["modo_transporte"]
          msds_archivo: string | null
          naviera: string | null
          operador: string
          organization_id: string
          peso_kg: number
          piezas: number
          puerto_destino: string | null
          puerto_origen: string | null
          shipper: string
          tiene_proforma: boolean
          tipo: Database["public"]["Enums"]["tipo_operacion"]
          tipo_cambio_eur: number
          tipo_cambio_usd: number
          tipo_carga: string
          tipo_contenedor: string | null
          tipo_servicio:
            | Database["public"]["Enums"]["tipo_servicio_maritimo"]
            | null
          transportista: string | null
          updated_at: string
          volumen_m3: number
        }
        Insert: {
          aerolinea?: string | null
          aeropuerto_destino?: string | null
          aeropuerto_origen?: string | null
          agente?: string | null
          bl_house?: string | null
          bl_master?: string | null
          carta_porte?: string | null
          ciudad_destino?: string | null
          ciudad_origen?: string | null
          cliente_id: string
          cliente_nombre?: string
          consignatario?: string
          contenedor?: string | null
          cotizacion_id?: string | null
          created_at?: string
          created_by?: string | null
          created_by_email?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          descripcion_mercancia?: string
          estado?: Database["public"]["Enums"]["estado_embarque"]
          eta?: string | null
          eta_original?: string | null
          etd?: string | null
          etd_original?: string | null
          expediente: string
          fecha_creacion?: string
          fecha_llegada_real?: string | null
          hawb?: string | null
          id?: string
          incoterm?: Database["public"]["Enums"]["incoterm"]
          mawb?: string | null
          modo: Database["public"]["Enums"]["modo_transporte"]
          msds_archivo?: string | null
          naviera?: string | null
          operador?: string
          organization_id?: string
          peso_kg?: number
          piezas?: number
          puerto_destino?: string | null
          puerto_origen?: string | null
          shipper?: string
          tiene_proforma?: boolean
          tipo: Database["public"]["Enums"]["tipo_operacion"]
          tipo_cambio_eur?: number
          tipo_cambio_usd?: number
          tipo_carga?: string
          tipo_contenedor?: string | null
          tipo_servicio?:
            | Database["public"]["Enums"]["tipo_servicio_maritimo"]
            | null
          transportista?: string | null
          updated_at?: string
          volumen_m3?: number
        }
        Update: {
          aerolinea?: string | null
          aeropuerto_destino?: string | null
          aeropuerto_origen?: string | null
          agente?: string | null
          bl_house?: string | null
          bl_master?: string | null
          carta_porte?: string | null
          ciudad_destino?: string | null
          ciudad_origen?: string | null
          cliente_id?: string
          cliente_nombre?: string
          consignatario?: string
          contenedor?: string | null
          cotizacion_id?: string | null
          created_at?: string
          created_by?: string | null
          created_by_email?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          descripcion_mercancia?: string
          estado?: Database["public"]["Enums"]["estado_embarque"]
          eta?: string | null
          eta_original?: string | null
          etd?: string | null
          etd_original?: string | null
          expediente?: string
          fecha_creacion?: string
          fecha_llegada_real?: string | null
          hawb?: string | null
          id?: string
          incoterm?: Database["public"]["Enums"]["incoterm"]
          mawb?: string | null
          modo?: Database["public"]["Enums"]["modo_transporte"]
          msds_archivo?: string | null
          naviera?: string | null
          operador?: string
          organization_id?: string
          peso_kg?: number
          piezas?: number
          puerto_destino?: string | null
          puerto_origen?: string | null
          shipper?: string
          tiene_proforma?: boolean
          tipo?: Database["public"]["Enums"]["tipo_operacion"]
          tipo_cambio_eur?: number
          tipo_cambio_usd?: number
          tipo_carga?: string
          tipo_contenedor?: string | null
          tipo_servicio?:
            | Database["public"]["Enums"]["tipo_servicio_maritimo"]
            | null
          transportista?: string | null
          updated_at?: string
          volumen_m3?: number
        }
        Relationships: [
          {
            foreignKeyName: "embarques_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "embarques_cotizacion_id_fkey"
            columns: ["cotizacion_id"]
            isOneToOne: false
            referencedRelation: "cotizaciones"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "embarques_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      eventos_embarque: {
        Row: {
          created_at: string
          deleted_at: string | null
          deleted_by: string | null
          descripcion: string
          embarque_id: string
          fecha: string
          id: string
          organization_id: string
          tipo: Database["public"]["Enums"]["tipo_evento_tracking"]
          ubicacion: string
          usuario: string
        }
        Insert: {
          created_at?: string
          deleted_at?: string | null
          deleted_by?: string | null
          descripcion?: string
          embarque_id: string
          fecha?: string
          id?: string
          organization_id?: string
          tipo: Database["public"]["Enums"]["tipo_evento_tracking"]
          ubicacion?: string
          usuario?: string
        }
        Update: {
          created_at?: string
          deleted_at?: string | null
          deleted_by?: string | null
          descripcion?: string
          embarque_id?: string
          fecha?: string
          id?: string
          organization_id?: string
          tipo?: Database["public"]["Enums"]["tipo_evento_tracking"]
          ubicacion?: string
          usuario?: string
        }
        Relationships: [
          {
            foreignKeyName: "eventos_embarque_embarque_id_fkey"
            columns: ["embarque_id"]
            isOneToOne: false
            referencedRelation: "embarques"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "eventos_embarque_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      factura_notas_credito: {
        Row: {
          aprobada_at: string | null
          aprobada_por: string | null
          created_at: string
          created_by: string | null
          deleted_at: string | null
          deleted_by: string | null
          descripcion: string
          estado: Database["public"]["Enums"]["estado_nota_credito"]
          factura_id: string
          fecha_emision: string
          folio: string
          id: string
          moneda: Database["public"]["Enums"]["moneda"]
          monto: number
          motivo: Database["public"]["Enums"]["motivo_nota_credito"]
          organization_id: string
          tipo_cambio: number
          updated_at: string
        }
        Insert: {
          aprobada_at?: string | null
          aprobada_por?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          descripcion?: string
          estado?: Database["public"]["Enums"]["estado_nota_credito"]
          factura_id: string
          fecha_emision?: string
          folio: string
          id?: string
          moneda?: Database["public"]["Enums"]["moneda"]
          monto: number
          motivo?: Database["public"]["Enums"]["motivo_nota_credito"]
          organization_id?: string
          tipo_cambio?: number
          updated_at?: string
        }
        Update: {
          aprobada_at?: string | null
          aprobada_por?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          descripcion?: string
          estado?: Database["public"]["Enums"]["estado_nota_credito"]
          factura_id?: string
          fecha_emision?: string
          folio?: string
          id?: string
          moneda?: Database["public"]["Enums"]["moneda"]
          monto?: number
          motivo?: Database["public"]["Enums"]["motivo_nota_credito"]
          organization_id?: string
          tipo_cambio?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "factura_notas_credito_factura_id_fkey"
            columns: ["factura_id"]
            isOneToOne: false
            referencedRelation: "facturas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "factura_notas_credito_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      factura_series: {
        Row: {
          activa: boolean
          codigo: string
          created_at: string
          descripcion: string | null
          es_default: boolean
          folio_actual: number
          folio_inicial: number
          id: string
          organization_id: string
          prefijo: string
          updated_at: string
        }
        Insert: {
          activa?: boolean
          codigo: string
          created_at?: string
          descripcion?: string | null
          es_default?: boolean
          folio_actual?: number
          folio_inicial?: number
          id?: string
          organization_id?: string
          prefijo?: string
          updated_at?: string
        }
        Update: {
          activa?: boolean
          codigo?: string
          created_at?: string
          descripcion?: string | null
          es_default?: boolean
          folio_actual?: number
          folio_inicial?: number
          id?: string
          organization_id?: string
          prefijo?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "factura_series_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      facturas: {
        Row: {
          cliente_id: string
          cliente_nombre: string
          created_at: string
          deleted_at: string | null
          deleted_by: string | null
          dias_credito: number | null
          embarque_id: string
          estado: Database["public"]["Enums"]["estado_factura"]
          expediente: string
          factura_pdf_url: string | null
          factura_xml_url: string | null
          fecha_emision: string
          fecha_vencimiento: string
          folio_fiscal: number | null
          forma_pago: string | null
          id: string
          iva: number
          metodo_pago: string | null
          moneda: Database["public"]["Enums"]["moneda"]
          notas: string | null
          numero: string
          organization_id: string
          proforma_id: string | null
          referencia_bl: string | null
          rfc_cliente: string | null
          serie_id: string | null
          snapshot_emision: Json | null
          subtotal: number
          tipo_cambio: number
          total: number
          updated_at: string
          uso_cfdi: string | null
          uuid_fiscal: string | null
        }
        Insert: {
          cliente_id: string
          cliente_nombre?: string
          created_at?: string
          deleted_at?: string | null
          deleted_by?: string | null
          dias_credito?: number | null
          embarque_id: string
          estado?: Database["public"]["Enums"]["estado_factura"]
          expediente?: string
          factura_pdf_url?: string | null
          factura_xml_url?: string | null
          fecha_emision?: string
          fecha_vencimiento?: string
          folio_fiscal?: number | null
          forma_pago?: string | null
          id?: string
          iva?: number
          metodo_pago?: string | null
          moneda?: Database["public"]["Enums"]["moneda"]
          notas?: string | null
          numero: string
          organization_id?: string
          proforma_id?: string | null
          referencia_bl?: string | null
          rfc_cliente?: string | null
          serie_id?: string | null
          snapshot_emision?: Json | null
          subtotal?: number
          tipo_cambio?: number
          total?: number
          updated_at?: string
          uso_cfdi?: string | null
          uuid_fiscal?: string | null
        }
        Update: {
          cliente_id?: string
          cliente_nombre?: string
          created_at?: string
          deleted_at?: string | null
          deleted_by?: string | null
          dias_credito?: number | null
          embarque_id?: string
          estado?: Database["public"]["Enums"]["estado_factura"]
          expediente?: string
          factura_pdf_url?: string | null
          factura_xml_url?: string | null
          fecha_emision?: string
          fecha_vencimiento?: string
          folio_fiscal?: number | null
          forma_pago?: string | null
          id?: string
          iva?: number
          metodo_pago?: string | null
          moneda?: Database["public"]["Enums"]["moneda"]
          notas?: string | null
          numero?: string
          organization_id?: string
          proforma_id?: string | null
          referencia_bl?: string | null
          rfc_cliente?: string | null
          serie_id?: string | null
          snapshot_emision?: Json | null
          subtotal?: number
          tipo_cambio?: number
          total?: number
          updated_at?: string
          uso_cfdi?: string | null
          uuid_fiscal?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "facturas_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "facturas_embarque_id_fkey"
            columns: ["embarque_id"]
            isOneToOne: false
            referencedRelation: "embarques"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "facturas_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "facturas_proforma_id_fkey"
            columns: ["proforma_id"]
            isOneToOne: false
            referencedRelation: "proformas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "facturas_serie_id_fkey"
            columns: ["serie_id"]
            isOneToOne: false
            referencedRelation: "factura_series"
            referencedColumns: ["id"]
          },
        ]
      }
      idempotency_keys: {
        Row: {
          created_at: string
          fn: string
          hits: number
          key: string
          organization_id: string
          response: Json | null
          user_id: string
        }
        Insert: {
          created_at?: string
          fn: string
          hits?: number
          key: string
          organization_id: string
          response?: Json | null
          user_id: string
        }
        Update: {
          created_at?: string
          fn?: string
          hits?: number
          key?: string
          organization_id?: string
          response?: Json | null
          user_id?: string
        }
        Relationships: []
      }
      navieras: {
        Row: {
          activo: boolean
          code: string
          created_at: string
          id: string
          name: string
        }
        Insert: {
          activo?: boolean
          code: string
          created_at?: string
          id?: string
          name: string
        }
        Update: {
          activo?: boolean
          code?: string
          created_at?: string
          id?: string
          name?: string
        }
        Relationships: []
      }
      notas_embarque: {
        Row: {
          contenido: string
          created_at: string
          deleted_at: string | null
          deleted_by: string | null
          embarque_id: string
          fecha: string
          id: string
          organization_id: string
          tipo: Database["public"]["Enums"]["tipo_nota"]
          usuario: string
        }
        Insert: {
          contenido: string
          created_at?: string
          deleted_at?: string | null
          deleted_by?: string | null
          embarque_id: string
          fecha?: string
          id?: string
          organization_id?: string
          tipo?: Database["public"]["Enums"]["tipo_nota"]
          usuario?: string
        }
        Update: {
          contenido?: string
          created_at?: string
          deleted_at?: string | null
          deleted_by?: string | null
          embarque_id?: string
          fecha?: string
          id?: string
          organization_id?: string
          tipo?: Database["public"]["Enums"]["tipo_nota"]
          usuario?: string
        }
        Relationships: [
          {
            foreignKeyName: "notas_embarque_embarque_id_fkey"
            columns: ["embarque_id"]
            isOneToOne: false
            referencedRelation: "embarques"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notas_embarque_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      notificaciones_cliente: {
        Row: {
          cliente_id: string
          created_at: string
          embarque_id: string | null
          factura_id: string | null
          id: string
          leida_at: string | null
          mensaje: string
          organization_id: string
          tipo: string
          titulo: string
          url: string | null
        }
        Insert: {
          cliente_id: string
          created_at?: string
          embarque_id?: string | null
          factura_id?: string | null
          id?: string
          leida_at?: string | null
          mensaje?: string
          organization_id?: string
          tipo: string
          titulo: string
          url?: string | null
        }
        Update: {
          cliente_id?: string
          created_at?: string
          embarque_id?: string | null
          factura_id?: string | null
          id?: string
          leida_at?: string | null
          mensaje?: string
          organization_id?: string
          tipo?: string
          titulo?: string
          url?: string | null
        }
        Relationships: []
      }
      notificaciones_internas: {
        Row: {
          created_at: string
          enlace: string | null
          entidad_id: string | null
          entidad_tipo: string | null
          id: string
          leida: boolean
          leida_at: string | null
          mensaje: string
          organization_id: string
          tipo: string
          titulo: string
          usuario_id: string
        }
        Insert: {
          created_at?: string
          enlace?: string | null
          entidad_id?: string | null
          entidad_tipo?: string | null
          id?: string
          leida?: boolean
          leida_at?: string | null
          mensaje: string
          organization_id: string
          tipo: string
          titulo: string
          usuario_id: string
        }
        Update: {
          created_at?: string
          enlace?: string | null
          entidad_id?: string | null
          entidad_tipo?: string | null
          id?: string
          leida?: boolean
          leida_at?: string | null
          mensaje?: string
          organization_id?: string
          tipo?: string
          titulo?: string
          usuario_id?: string
        }
        Relationships: []
      }
      organization_members: {
        Row: {
          created_at: string | null
          id: string
          organization_id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          organization_id: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          organization_id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "organization_members_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organizations: {
        Row: {
          activo: boolean | null
          created_at: string | null
          id: string
          logo_url: string | null
          nombre: string
          plan: string | null
          rfc: string | null
          updated_at: string | null
        }
        Insert: {
          activo?: boolean | null
          created_at?: string | null
          id?: string
          logo_url?: string | null
          nombre: string
          plan?: string | null
          rfc?: string | null
          updated_at?: string | null
        }
        Update: {
          activo?: boolean | null
          created_at?: string | null
          id?: string
          logo_url?: string | null
          nombre?: string
          plan?: string | null
          rfc?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      pagos_factura: {
        Row: {
          created_at: string
          created_by: string | null
          deleted_at: string | null
          deleted_by: string | null
          diferencia_cambiaria_mxn: number
          factura_id: string
          fecha_pago: string
          forma_pago: string
          id: string
          moneda: Database["public"]["Enums"]["moneda"]
          monto: number
          monto_aplicado_factura: number
          notas: string
          organization_id: string
          referencia: string
          tipo_cambio: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          diferencia_cambiaria_mxn?: number
          factura_id: string
          fecha_pago: string
          forma_pago?: string
          id?: string
          moneda?: Database["public"]["Enums"]["moneda"]
          monto: number
          monto_aplicado_factura: number
          notas?: string
          organization_id?: string
          referencia?: string
          tipo_cambio?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          diferencia_cambiaria_mxn?: number
          factura_id?: string
          fecha_pago?: string
          forma_pago?: string
          id?: string
          moneda?: Database["public"]["Enums"]["moneda"]
          monto?: number
          monto_aplicado_factura?: number
          notas?: string
          organization_id?: string
          referencia?: string
          tipo_cambio?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "pagos_factura_factura_id_fkey"
            columns: ["factura_id"]
            isOneToOne: false
            referencedRelation: "facturas"
            referencedColumns: ["id"]
          },
        ]
      }
      pagos_proveedor: {
        Row: {
          created_at: string
          created_by: string | null
          cuenta_bancaria_id: string | null
          deleted_at: string | null
          deleted_by: string | null
          diferencia_cambiaria_mxn: number | null
          fecha_pago: string
          id: string
          metodo_pago: string
          moneda: Database["public"]["Enums"]["moneda"]
          monto: number
          notas: string
          organization_id: string
          proveedor_factura_id: string
          referencia: string
          tipo_cambio_usd: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          cuenta_bancaria_id?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          diferencia_cambiaria_mxn?: number | null
          fecha_pago?: string
          id?: string
          metodo_pago?: string
          moneda?: Database["public"]["Enums"]["moneda"]
          monto?: number
          notas?: string
          organization_id?: string
          proveedor_factura_id: string
          referencia?: string
          tipo_cambio_usd?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          cuenta_bancaria_id?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          diferencia_cambiaria_mxn?: number | null
          fecha_pago?: string
          id?: string
          metodo_pago?: string
          moneda?: Database["public"]["Enums"]["moneda"]
          monto?: number
          notas?: string
          organization_id?: string
          proveedor_factura_id?: string
          referencia?: string
          tipo_cambio_usd?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "pagos_proveedor_proveedor_factura_id_fkey"
            columns: ["proveedor_factura_id"]
            isOneToOne: false
            referencedRelation: "proveedor_facturas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pagos_proveedor_proveedor_factura_id_fkey"
            columns: ["proveedor_factura_id"]
            isOneToOne: false
            referencedRelation: "v_proveedor_facturas_saldo"
            referencedColumns: ["proveedor_factura_id"]
          },
        ]
      }
      planes: {
        Row: {
          activo: boolean
          almacenamiento_mb: number
          created_at: string | null
          id: string
          max_embarques_mes: number
          max_usuarios: number
          nombre: string
          precio_mensual: number
        }
        Insert: {
          activo?: boolean
          almacenamiento_mb?: number
          created_at?: string | null
          id?: string
          max_embarques_mes?: number
          max_usuarios?: number
          nombre: string
          precio_mensual?: number
        }
        Update: {
          activo?: boolean
          almacenamiento_mb?: number
          created_at?: string | null
          id?: string
          max_embarques_mes?: number
          max_usuarios?: number
          nombre?: string
          precio_mensual?: number
        }
        Relationships: []
      }
      proforma_conceptos_consolidados: {
        Row: {
          aplica_iva: boolean
          cantidad: number
          contenedor: string | null
          created_at: string
          deleted_at: string | null
          deleted_by: string | null
          descripcion: string
          embarque_id: string | null
          id: string
          iva: number
          moneda: Database["public"]["Enums"]["moneda"]
          organization_id: string
          precio_unitario: number
          proforma_id: string
          tasa_iva_aplicada: number
          tipo_contenedor: string | null
          total: number
        }
        Insert: {
          aplica_iva?: boolean
          cantidad?: number
          contenedor?: string | null
          created_at?: string
          deleted_at?: string | null
          deleted_by?: string | null
          descripcion: string
          embarque_id?: string | null
          id?: string
          iva?: number
          moneda?: Database["public"]["Enums"]["moneda"]
          organization_id?: string
          precio_unitario?: number
          proforma_id: string
          tasa_iva_aplicada?: number
          tipo_contenedor?: string | null
          total?: number
        }
        Update: {
          aplica_iva?: boolean
          cantidad?: number
          contenedor?: string | null
          created_at?: string
          deleted_at?: string | null
          deleted_by?: string | null
          descripcion?: string
          embarque_id?: string | null
          id?: string
          iva?: number
          moneda?: Database["public"]["Enums"]["moneda"]
          organization_id?: string
          precio_unitario?: number
          proforma_id?: string
          tasa_iva_aplicada?: number
          tipo_contenedor?: string | null
          total?: number
        }
        Relationships: [
          {
            foreignKeyName: "pcc_embarque_id_fkey"
            columns: ["embarque_id"]
            isOneToOne: false
            referencedRelation: "embarques"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pcc_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "proforma_conceptos_consolidados_proforma_id_fkey"
            columns: ["proforma_id"]
            isOneToOne: false
            referencedRelation: "proformas"
            referencedColumns: ["id"]
          },
        ]
      }
      proformas: {
        Row: {
          bl_master: string | null
          cliente_id: string
          cliente_nombre: string
          consolidada_en: string | null
          created_at: string
          created_by: string | null
          deleted_at: string | null
          deleted_by: string | null
          dias_credito: number | null
          embarque_id: string | null
          embarques_ids: string[] | null
          es_consolidada: boolean
          estado_aprobacion: string
          estado_proforma: string
          estado_revision: string
          expediente: string
          factura_id: string | null
          factura_secundaria_id: string | null
          fecha_emision: string
          fecha_facturacion: string | null
          folio_factura_externa: string | null
          id: string
          iva_mxn: number
          iva_usd: number
          notas: string | null
          numero: string
          operador: string | null
          organization_id: string
          proformas_origen: string[] | null
          snapshot_emision: Json | null
          subtotal_mxn: number
          subtotal_usd: number
          tasa_iva_aplicada: number
          total_mxn: number
          total_usd: number
          updated_at: string
        }
        Insert: {
          bl_master?: string | null
          cliente_id: string
          cliente_nombre: string
          consolidada_en?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          dias_credito?: number | null
          embarque_id?: string | null
          embarques_ids?: string[] | null
          es_consolidada?: boolean
          estado_aprobacion?: string
          estado_proforma?: string
          estado_revision?: string
          expediente: string
          factura_id?: string | null
          factura_secundaria_id?: string | null
          fecha_emision?: string
          fecha_facturacion?: string | null
          folio_factura_externa?: string | null
          id?: string
          iva_mxn?: number
          iva_usd?: number
          notas?: string | null
          numero: string
          operador?: string | null
          organization_id?: string
          proformas_origen?: string[] | null
          snapshot_emision?: Json | null
          subtotal_mxn?: number
          subtotal_usd?: number
          tasa_iva_aplicada?: number
          total_mxn?: number
          total_usd?: number
          updated_at?: string
        }
        Update: {
          bl_master?: string | null
          cliente_id?: string
          cliente_nombre?: string
          consolidada_en?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          dias_credito?: number | null
          embarque_id?: string | null
          embarques_ids?: string[] | null
          es_consolidada?: boolean
          estado_aprobacion?: string
          estado_proforma?: string
          estado_revision?: string
          expediente?: string
          factura_id?: string | null
          factura_secundaria_id?: string | null
          fecha_emision?: string
          fecha_facturacion?: string | null
          folio_factura_externa?: string | null
          id?: string
          iva_mxn?: number
          iva_usd?: number
          notas?: string | null
          numero?: string
          operador?: string | null
          organization_id?: string
          proformas_origen?: string[] | null
          snapshot_emision?: Json | null
          subtotal_mxn?: number
          subtotal_usd?: number
          tasa_iva_aplicada?: number
          total_mxn?: number
          total_usd?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "proformas_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "proformas_consolidada_en_fkey"
            columns: ["consolidada_en"]
            isOneToOne: false
            referencedRelation: "proformas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "proformas_embarque_id_fkey"
            columns: ["embarque_id"]
            isOneToOne: false
            referencedRelation: "embarques"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "proformas_factura_id_fkey"
            columns: ["factura_id"]
            isOneToOne: false
            referencedRelation: "facturas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "proformas_factura_secundaria_id_fkey"
            columns: ["factura_secundaria_id"]
            isOneToOne: false
            referencedRelation: "facturas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "proformas_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      proveedor_facturas: {
        Row: {
          archivo_pdf_url: string | null
          archivo_xml_url: string | null
          created_at: string
          created_by: string | null
          deleted_at: string | null
          deleted_by: string | null
          dias_credito: number
          embarque_id: string | null
          estado: Database["public"]["Enums"]["estado_proveedor_factura"]
          fecha_emision: string
          fecha_vencimiento: string | null
          folio_proveedor: string
          id: string
          iva: number
          moneda: Database["public"]["Enums"]["moneda"]
          notas: string
          organization_id: string
          proveedor_id: string
          proveedor_nombre: string
          retenciones: number
          rfc_proveedor: string | null
          subtotal: number
          tipo_cambio_usd: number
          total: number
          updated_at: string
          uuid_fiscal: string | null
        }
        Insert: {
          archivo_pdf_url?: string | null
          archivo_xml_url?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          dias_credito?: number
          embarque_id?: string | null
          estado?: Database["public"]["Enums"]["estado_proveedor_factura"]
          fecha_emision?: string
          fecha_vencimiento?: string | null
          folio_proveedor: string
          id?: string
          iva?: number
          moneda?: Database["public"]["Enums"]["moneda"]
          notas?: string
          organization_id?: string
          proveedor_id: string
          proveedor_nombre?: string
          retenciones?: number
          rfc_proveedor?: string | null
          subtotal?: number
          tipo_cambio_usd?: number
          total?: number
          updated_at?: string
          uuid_fiscal?: string | null
        }
        Update: {
          archivo_pdf_url?: string | null
          archivo_xml_url?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          dias_credito?: number
          embarque_id?: string | null
          estado?: Database["public"]["Enums"]["estado_proveedor_factura"]
          fecha_emision?: string
          fecha_vencimiento?: string | null
          folio_proveedor?: string
          id?: string
          iva?: number
          moneda?: Database["public"]["Enums"]["moneda"]
          notas?: string
          organization_id?: string
          proveedor_id?: string
          proveedor_nombre?: string
          retenciones?: number
          rfc_proveedor?: string | null
          subtotal?: number
          tipo_cambio_usd?: number
          total?: number
          updated_at?: string
          uuid_fiscal?: string | null
        }
        Relationships: []
      }
      proveedor_facturas_conceptos: {
        Row: {
          cantidad: number
          concepto_costo_id: string | null
          created_at: string
          descripcion: string
          id: string
          monto: number
          organization_id: string
          proveedor_factura_id: string
        }
        Insert: {
          cantidad?: number
          concepto_costo_id?: string | null
          created_at?: string
          descripcion?: string
          id?: string
          monto?: number
          organization_id?: string
          proveedor_factura_id: string
        }
        Update: {
          cantidad?: number
          concepto_costo_id?: string | null
          created_at?: string
          descripcion?: string
          id?: string
          monto?: number
          organization_id?: string
          proveedor_factura_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "proveedor_facturas_conceptos_proveedor_factura_id_fkey"
            columns: ["proveedor_factura_id"]
            isOneToOne: false
            referencedRelation: "proveedor_facturas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "proveedor_facturas_conceptos_proveedor_factura_id_fkey"
            columns: ["proveedor_factura_id"]
            isOneToOne: false
            referencedRelation: "v_proveedor_facturas_saldo"
            referencedColumns: ["proveedor_factura_id"]
          },
        ]
      }
      proveedor_notas_credito: {
        Row: {
          aprobada_at: string | null
          aprobada_por: string | null
          created_at: string
          created_by: string | null
          deleted_at: string | null
          deleted_by: string | null
          descripcion: string
          estado: Database["public"]["Enums"]["estado_nota_credito_proveedor"]
          fecha: string
          folio_nc: string
          id: string
          moneda: Database["public"]["Enums"]["moneda"]
          monto: number
          motivo: Database["public"]["Enums"]["motivo_nota_credito_proveedor"]
          organization_id: string
          proveedor_factura_id: string
          updated_at: string
        }
        Insert: {
          aprobada_at?: string | null
          aprobada_por?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          descripcion?: string
          estado?: Database["public"]["Enums"]["estado_nota_credito_proveedor"]
          fecha?: string
          folio_nc?: string
          id?: string
          moneda?: Database["public"]["Enums"]["moneda"]
          monto?: number
          motivo?: Database["public"]["Enums"]["motivo_nota_credito_proveedor"]
          organization_id?: string
          proveedor_factura_id: string
          updated_at?: string
        }
        Update: {
          aprobada_at?: string | null
          aprobada_por?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          descripcion?: string
          estado?: Database["public"]["Enums"]["estado_nota_credito_proveedor"]
          fecha?: string
          folio_nc?: string
          id?: string
          moneda?: Database["public"]["Enums"]["moneda"]
          monto?: number
          motivo?: Database["public"]["Enums"]["motivo_nota_credito_proveedor"]
          organization_id?: string
          proveedor_factura_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "proveedor_notas_credito_proveedor_factura_id_fkey"
            columns: ["proveedor_factura_id"]
            isOneToOne: false
            referencedRelation: "proveedor_facturas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "proveedor_notas_credito_proveedor_factura_id_fkey"
            columns: ["proveedor_factura_id"]
            isOneToOne: false
            referencedRelation: "v_proveedor_facturas_saldo"
            referencedColumns: ["proveedor_factura_id"]
          },
        ]
      }
      proveedores: {
        Row: {
          contacto: string
          created_at: string
          email: string
          id: string
          moneda_preferida: Database["public"]["Enums"]["moneda"]
          nombre: string
          organization_id: string
          origen_proveedor:
            | Database["public"]["Enums"]["origen_proveedor"]
            | null
          pais: string | null
          rfc: string
          telefono: string
          tipo: Database["public"]["Enums"]["tipo_proveedor"]
          updated_at: string
        }
        Insert: {
          contacto?: string
          created_at?: string
          email?: string
          id?: string
          moneda_preferida?: Database["public"]["Enums"]["moneda"]
          nombre: string
          organization_id?: string
          origen_proveedor?:
            | Database["public"]["Enums"]["origen_proveedor"]
            | null
          pais?: string | null
          rfc?: string
          telefono?: string
          tipo: Database["public"]["Enums"]["tipo_proveedor"]
          updated_at?: string
        }
        Update: {
          contacto?: string
          created_at?: string
          email?: string
          id?: string
          moneda_preferida?: Database["public"]["Enums"]["moneda"]
          nombre?: string
          organization_id?: string
          origen_proveedor?:
            | Database["public"]["Enums"]["origen_proveedor"]
            | null
          pais?: string | null
          rfc?: string
          telefono?: string
          tipo?: Database["public"]["Enums"]["tipo_proveedor"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "proveedores_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      puertos: {
        Row: {
          activo: boolean
          code: string
          country: string
          created_at: string
          id: string
          name: string
        }
        Insert: {
          activo?: boolean
          code: string
          country: string
          created_at?: string
          id?: string
          name: string
        }
        Update: {
          activo?: boolean
          code?: string
          country?: string
          created_at?: string
          id?: string
          name?: string
        }
        Relationships: []
      }
      ratelimit_buckets: {
        Row: {
          bucket_key: string
          count: number
          updated_at: string
          window_start: string
        }
        Insert: {
          bucket_key: string
          count?: number
          updated_at?: string
          window_start?: string
        }
        Update: {
          bucket_key?: string
          count?: number
          updated_at?: string
          window_start?: string
        }
        Relationships: []
      }
      tipos_contenedor: {
        Row: {
          activo: boolean
          code: string
          created_at: string
          id: string
          name: string
        }
        Insert: {
          activo?: boolean
          code: string
          created_at?: string
          id?: string
          name: string
        }
        Update: {
          activo?: boolean
          code?: string
          created_at?: string
          id?: string
          name?: string
        }
        Relationships: []
      }
      tracking_externo: {
        Row: {
          created_at: string
          embarque_id: string
          failed_reason: string | null
          id: string
          last_event_at: string | null
          last_synced_at: string | null
          organization_id: string
          provider: string
          raw_payload: Json | null
          request_number: string
          request_type: string
          scac: string
          shipment_id: string | null
          status: string
          tracking_request_id: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          embarque_id: string
          failed_reason?: string | null
          id?: string
          last_event_at?: string | null
          last_synced_at?: string | null
          organization_id?: string
          provider?: string
          raw_payload?: Json | null
          request_number: string
          request_type: string
          scac: string
          shipment_id?: string | null
          status?: string
          tracking_request_id?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          embarque_id?: string
          failed_reason?: string | null
          id?: string
          last_event_at?: string | null
          last_synced_at?: string | null
          organization_id?: string
          provider?: string
          raw_payload?: Json | null
          request_number?: string
          request_type?: string
          scac?: string
          shipment_id?: string | null
          status?: string
          tracking_request_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tracking_externo_embarque_id_fkey"
            columns: ["embarque_id"]
            isOneToOne: false
            referencedRelation: "embarques"
            referencedColumns: ["id"]
          },
        ]
      }
      tracking_intentos: {
        Row: {
          accion: string
          created_at: string
          detalle: Json | null
          embarque_id: string
          http_status: number | null
          id: string
          mensaje: string | null
          organization_id: string
          provider: string
          request_number: string | null
          request_type: string | null
          resultado: string
          scac: string | null
          tracking_request_id: string | null
          usuario_email: string | null
          usuario_id: string | null
        }
        Insert: {
          accion?: string
          created_at?: string
          detalle?: Json | null
          embarque_id: string
          http_status?: number | null
          id?: string
          mensaje?: string | null
          organization_id: string
          provider?: string
          request_number?: string | null
          request_type?: string | null
          resultado: string
          scac?: string | null
          tracking_request_id?: string | null
          usuario_email?: string | null
          usuario_id?: string | null
        }
        Update: {
          accion?: string
          created_at?: string
          detalle?: Json | null
          embarque_id?: string
          http_status?: number | null
          id?: string
          mensaje?: string | null
          organization_id?: string
          provider?: string
          request_number?: string | null
          request_type?: string | null
          resultado?: string
          scac?: string | null
          tracking_request_id?: string | null
          usuario_email?: string | null
          usuario_id?: string | null
        }
        Relationships: []
      }
      tracking_links: {
        Row: {
          created_at: string | null
          created_by: string
          embarque_id: string
          expires_at: string | null
          id: string
          organization_id: string
          token: string
        }
        Insert: {
          created_at?: string | null
          created_by?: string
          embarque_id: string
          expires_at?: string | null
          id?: string
          organization_id?: string
          token?: string
        }
        Update: {
          created_at?: string | null
          created_by?: string
          embarque_id?: string
          expires_at?: string | null
          id?: string
          organization_id?: string
          token?: string
        }
        Relationships: [
          {
            foreignKeyName: "tracking_links_embarque_id_fkey"
            columns: ["embarque_id"]
            isOneToOne: false
            referencedRelation: "embarques"
            referencedColumns: ["id"]
          },
        ]
      }
      tracking_webhook_log: {
        Row: {
          error: string | null
          event_id: string | null
          event_type: string
          id: string
          payload: Json
          processed: boolean
          processed_at: string | null
          provider: string
          received_at: string
          shipment_id: string | null
          tracking_request_id: string | null
        }
        Insert: {
          error?: string | null
          event_id?: string | null
          event_type: string
          id?: string
          payload: Json
          processed?: boolean
          processed_at?: string | null
          provider?: string
          received_at?: string
          shipment_id?: string | null
          tracking_request_id?: string | null
        }
        Update: {
          error?: string | null
          event_id?: string | null
          event_type?: string
          id?: string
          payload?: Json
          processed?: boolean
          processed_at?: string | null
          provider?: string
          received_at?: string
          shipment_id?: string | null
          tracking_request_id?: string | null
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      v_proveedor_facturas_saldo: {
        Row: {
          notas_credito_aplicadas: number | null
          organization_id: string | null
          pagado: number | null
          proveedor_factura_id: string | null
          saldo: number | null
          total: number | null
        }
        Insert: {
          notas_credito_aplicadas?: never
          organization_id?: string | null
          pagado?: never
          proveedor_factura_id?: string | null
          saldo?: never
          total?: number | null
        }
        Update: {
          notas_credito_aplicadas?: never
          organization_id?: string | null
          pagado?: never
          proveedor_factura_id?: string | null
          saldo?: never
          total?: number | null
        }
        Relationships: []
      }
    }
    Functions: {
      actualizar_cotizacion_costos: {
        Args: { p_costos: Json; p_cotizacion_id: string; p_request_id?: string }
        Returns: Json
      }
      actualizar_embarque_completo: {
        Args: {
          p_conceptos_costo?: Json
          p_conceptos_venta?: Json
          p_embarque: Json
          p_embarque_id: string
          p_request_id?: string
        }
        Returns: Json
      }
      alertas_sistema_pending_count: { Args: never; Returns: number }
      app_logs_health_summary: {
        Args: { p_hours?: number }
        Returns: {
          errors: number
          fn: string
          last_error_ts: string
          last_ts: string
          p50_ms: number
          p95_ms: number
          total: number
          warns: number
        }[]
      }
      app_logs_health_timeline: {
        Args: { p_buckets?: number; p_hours?: number }
        Returns: {
          bucket: string
          errors: number
          total: number
          warns: number
        }[]
      }
      aprobar_nota_credito_proveedor: {
        Args: { _nc_id: string }
        Returns: undefined
      }
      auditoria_capturar_snapshot: {
        Args: { p_organization_id: string }
        Returns: string
      }
      auditoria_embarques_org:
        | { Args: never; Returns: Json }
        | { Args: { p_organization_id: string }; Returns: Json }
      avanzar_estado_embarque: {
        Args: {
          p_descripcion_evento: string
          p_embarque_id: string
          p_nuevo_estado: string
          p_request_id?: string
          p_tipo_evento: string
          p_usuario_email: string
        }
        Returns: Json
      }
      busqueda_global: {
        Args: { limite?: number; termino: string }
        Returns: {
          id: string
          label: string
          sublabel: string
          tipo: string
          url: string
        }[]
      }
      can_manage_document_object: {
        Args: { _object_name: string }
        Returns: boolean
      }
      check_ratelimit: {
        Args: { p_key: string; p_max?: number; p_window_seconds?: number }
        Returns: Json
      }
      clientes_listado: {
        Args: {
          p_limit?: number
          p_offset?: number
          p_organization_id?: string
          p_search?: string
        }
        Returns: {
          ciudad: string
          contacto: string
          deuda_pendiente: number
          dias_credito: number
          email: string
          estado: string
          id: string
          nombre: string
          rfc: string
          telefono: string
          total_cotizaciones: number
          total_count: number
          total_embarques: number
        }[]
      }
      consolidar_proformas:
        | {
            Args: {
              p_bl_master: string
              p_cliente_id: string
              p_cliente_nombre: string
              p_dias_credito: number
              p_embarque_id: string
              p_expediente: string
              p_operador: string
              p_organization_id: string
              p_proforma_ids: string[]
              p_request_id?: string
              p_tasa_iva?: number
            }
            Returns: {
              bl_master: string | null
              cliente_id: string
              cliente_nombre: string
              consolidada_en: string | null
              created_at: string
              created_by: string | null
              deleted_at: string | null
              deleted_by: string | null
              dias_credito: number | null
              embarque_id: string | null
              embarques_ids: string[] | null
              es_consolidada: boolean
              estado_aprobacion: string
              estado_proforma: string
              estado_revision: string
              expediente: string
              factura_id: string | null
              factura_secundaria_id: string | null
              fecha_emision: string
              fecha_facturacion: string | null
              folio_factura_externa: string | null
              id: string
              iva_mxn: number
              iva_usd: number
              notas: string | null
              numero: string
              operador: string | null
              organization_id: string
              proformas_origen: string[] | null
              snapshot_emision: Json | null
              subtotal_mxn: number
              subtotal_usd: number
              tasa_iva_aplicada: number
              total_mxn: number
              total_usd: number
              updated_at: string
            }
            SetofOptions: {
              from: "*"
              to: "proformas"
              isOneToOne: true
              isSetofReturn: false
            }
          }
        | {
            Args: {
              p_bl_master: string
              p_cliente_id: string
              p_cliente_nombre: string
              p_dias_credito: number
              p_embarque_id: string
              p_expediente: string
              p_operador: string
              p_organization_id: string
              p_proforma_ids: string[]
              p_request_id?: string
              p_tasa_iva: number
            }
            Returns: {
              bl_master: string | null
              cliente_id: string
              cliente_nombre: string
              consolidada_en: string | null
              created_at: string
              created_by: string | null
              deleted_at: string | null
              deleted_by: string | null
              dias_credito: number | null
              embarque_id: string | null
              embarques_ids: string[] | null
              es_consolidada: boolean
              estado_aprobacion: string
              estado_proforma: string
              estado_revision: string
              expediente: string
              factura_id: string | null
              factura_secundaria_id: string | null
              fecha_emision: string
              fecha_facturacion: string | null
              folio_factura_externa: string | null
              id: string
              iva_mxn: number
              iva_usd: number
              notas: string | null
              numero: string
              operador: string | null
              organization_id: string
              proformas_origen: string[] | null
              snapshot_emision: Json | null
              subtotal_mxn: number
              subtotal_usd: number
              tasa_iva_aplicada: number
              total_mxn: number
              total_usd: number
              updated_at: string
            }
            SetofOptions: {
              from: "*"
              to: "proformas"
              isOneToOne: true
              isSetofReturn: false
            }
          }
      cotizaciones_listado: {
        Args: {
          p_cliente_id?: string
          p_estado?: string
          p_fecha_desde?: string
          p_fecha_hasta?: string
          p_limit?: number
          p_modo?: string
          p_offset?: number
          p_organization_id?: string
          p_search?: string
        }
        Returns: {
          cliente_id: string
          cliente_nombre: string
          created_at: string
          descripcion_mercancia: string
          destino: string
          embarques_vinculados: number
          estado: Database["public"]["Enums"]["estado_cotizacion"]
          fecha_vigencia: string
          folio: string
          id: string
          modo: Database["public"]["Enums"]["modo_transporte"]
          moneda: Database["public"]["Enums"]["moneda"]
          origen: string
          subtotal: number
          total_count: number
        }[]
      }
      crear_embarque_borrador_desde_cotizacion: {
        Args: { p_cotizacion_id: string }
        Returns: string
      }
      crear_embarque_completo: {
        Args: {
          p_conceptos_costo?: Json
          p_conceptos_venta?: Json
          p_documentos?: Json
          p_embarque: Json
          p_request_id?: string
        }
        Returns: Json
      }
      crear_proforma_atomica: {
        Args: {
          p_bl_master: string
          p_cliente_id: string
          p_cliente_nombre: string
          p_concepto_ids: string[]
          p_dias_credito: number
          p_embarque_id: string
          p_expediente: string
          p_iva_mxn: number
          p_iva_overrides?: Json
          p_iva_usd: number
          p_notas: string
          p_operador: string
          p_organization_id: string
          p_subtotal_mxn: number
          p_subtotal_usd: number
          p_tasa_iva: number
          p_total_mxn: number
          p_total_usd: number
        }
        Returns: {
          bl_master: string | null
          cliente_id: string
          cliente_nombre: string
          consolidada_en: string | null
          created_at: string
          created_by: string | null
          deleted_at: string | null
          deleted_by: string | null
          dias_credito: number | null
          embarque_id: string | null
          embarques_ids: string[] | null
          es_consolidada: boolean
          estado_aprobacion: string
          estado_proforma: string
          estado_revision: string
          expediente: string
          factura_id: string | null
          factura_secundaria_id: string | null
          fecha_emision: string
          fecha_facturacion: string | null
          folio_factura_externa: string | null
          id: string
          iva_mxn: number
          iva_usd: number
          notas: string | null
          numero: string
          operador: string | null
          organization_id: string
          proformas_origen: string[] | null
          snapshot_emision: Json | null
          subtotal_mxn: number
          subtotal_usd: number
          tasa_iva_aplicada: number
          total_mxn: number
          total_usd: number
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "proformas"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      current_user_client_ids: { Args: never; Returns: string[] }
      current_user_org_id: { Args: never; Returns: string }
      dashboard_details: { Args: never; Returns: Json }
      dashboard_stats: { Args: never; Returns: Json }
      dashboard_summary: { Args: never; Returns: Json }
      detectar_alertas_app_logs: { Args: never; Returns: number }
      duplicar_embarque_completo: {
        Args: {
          p_copias: Json
          p_embarque_origen_id: string
          p_request_id?: string
        }
        Returns: Json
      }
      eliminar_embarque_completo: {
        Args: { p_embarque_id: string }
        Returns: undefined
      }
      embarques_list_extras: {
        Args: { p_ids: string[] }
        Returns: {
          costos_pagados: number
          costos_total: number
          docs_pendientes: number
          docs_total: number
          embarque_id: string
        }[]
      }
      embarques_listado: {
        Args: {
          p_cliente_id?: string
          p_fecha_desde?: string
          p_fecha_hasta?: string
          p_limit?: number
          p_modo?: string
          p_offset?: number
          p_operador?: string
          p_organization_id?: string
          p_proforma?: string
          p_search?: string
          p_sort_by?: string
          p_sort_dir?: string
        }
        Returns: {
          aeropuerto_destino: string
          aeropuerto_origen: string
          bl_master: string
          ciudad_destino: string
          ciudad_origen: string
          cliente_id: string
          cliente_nombre: string
          contenedor: string
          costos_pagados: number
          costos_total: number
          created_at: string
          descripcion_mercancia: string
          docs_pendientes: number
          docs_total: number
          estado: Database["public"]["Enums"]["estado_embarque"]
          eta: string
          etd: string
          expediente: string
          id: string
          modo: Database["public"]["Enums"]["modo_transporte"]
          operador: string
          puerto_destino: string
          puerto_origen: string
          tiene_proforma: boolean
          tipo: Database["public"]["Enums"]["tipo_operacion"]
          tipo_cambio_eur: number
          tipo_cambio_usd: number
          tipo_contenedor: string
          total_count: number
        }[]
      }
      facturas_listado: {
        Args: {
          p_estado?: string
          p_fecha_desde?: string
          p_fecha_hasta?: string
          p_limit?: number
          p_offset?: number
          p_organization_id?: string
          p_search?: string
        }
        Returns: {
          cliente_nombre: string
          estado: Database["public"]["Enums"]["estado_factura"]
          expediente: string
          factura_pdf_url: string
          factura_xml_url: string
          fecha_emision: string
          fecha_vencimiento: string
          id: string
          moneda: Database["public"]["Enums"]["moneda"]
          numero: string
          proforma_id: string
          proforma_numero: string
          total: number
          total_count: number
        }[]
      }
      generar_expediente: { Args: { tipo_op: string }; Returns: string }
      generar_numero_proforma: { Args: { p_org_id: string }; Returns: string }
      get_embarque_full: { Args: { p_embarque_id: string }; Returns: Json }
      get_tracking_public: { Args: { p_token: string }; Returns: Json }
      get_user_context: { Args: never; Returns: Json }
      get_user_org_ids: { Args: { _user_id: string }; Returns: string[] }
      has_org_role: {
        Args: {
          _org_id: string
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      idempotency_claim: { Args: { _fn: string; _key: string }; Returns: Json }
      idempotency_store: {
        Args: { _key: string; _response: Json }
        Returns: undefined
      }
      is_org_admin: {
        Args: { _org_id: string; _user_id: string }
        Returns: boolean
      }
      is_soft_delete_table: { Args: { _table: string }; Returns: boolean }
      list_idempotency_log: {
        Args: { _limit?: number; _offset?: number }
        Returns: {
          created_at: string
          fn: string
          has_response: boolean
          hits: number
          key: string
          pending: boolean
          user_email: string
          user_id: string
        }[]
      }
      list_trash: {
        Args: { _limit?: number; _offset?: number; _table: string }
        Returns: {
          deleted_at: string
          deleted_by: string
          deleted_by_email: string
          id: string
          label: string
          organization_id: string
        }[]
      }
      log_client_error_v1: {
        Args: {
          p_app_version?: string
          p_component_stack?: string
          p_message: string
          p_request_id?: string
          p_route?: string
          p_stack?: string
          p_user_agent?: string
        }
        Returns: string
      }
      marcar_proforma_facturada: {
        Args: {
          p_fecha: string
          p_folio: string
          p_id: string
          p_request_id?: string
        }
        Returns: undefined
      }
      notificacion_cliente_marcar_leida: {
        Args: { p_id: string }
        Returns: undefined
      }
      notificaciones_cliente_marcar_todas_leidas: {
        Args: never
        Returns: number
      }
      operaciones_stats: { Args: never; Returns: Json }
      operadores_distintos: {
        Args: never
        Returns: {
          operador: string
        }[]
      }
      portal_responder_cotizacion:
        | {
            Args: { p_cotizacion_id: string; p_respuesta: string }
            Returns: Json
          }
        | {
            Args: {
              p_comentario?: string
              p_cotizacion_id: string
              p_respuesta: string
            }
            Returns: Json
          }
      portal_update_contacto: {
        Args: { _nombre: string; _telefono: string }
        Returns: undefined
      }
      profit_por_cliente: {
        Args: { _fecha_desde?: string; _fecha_hasta?: string; _modo?: string }
        Returns: {
          cliente_id: string
          cliente_nombre: string
          costo_usd: number
          total_embarques: number
          venta_usd: number
        }[]
      }
      profit_por_embarque: {
        Args: never
        Returns: {
          costo_mxn: number
          costo_mxn_from_eur: number
          costo_mxn_from_usd: number
          costo_mxn_native: number
          costo_usd: number
          embarque_id: string
          tipo_cambio_eur: number
          tipo_cambio_usd: number
          venta_mxn: number
          venta_mxn_from_eur: number
          venta_mxn_from_usd: number
          venta_mxn_native: number
          venta_usd: number
        }[]
      }
      proveedores_listado: {
        Args: {
          p_limit?: number
          p_offset?: number
          p_organization_id?: string
          p_search?: string
          p_tipo?: string
        }
        Returns: {
          contacto: string
          id: string
          moneda_preferida: Database["public"]["Enums"]["moneda"]
          monto_pendiente: number
          nombre: string
          pais: string
          rfc: string
          tipo: Database["public"]["Enums"]["tipo_proveedor"]
          total_count: number
          total_operaciones: number
        }[]
      }
      purge_app_logs_old: { Args: never; Returns: number }
      purge_record: {
        Args: { _id: string; _table: string }
        Returns: undefined
      }
      reportes_resumen: {
        Args: {
          p_fecha_desde?: string
          p_fecha_hasta?: string
          p_modo?: string
        }
        Returns: Json
      }
      reservar_folio_factura: {
        Args: { _serie_id: string }
        Returns: {
          folio: number
          numero: string
        }[]
      }
      resolver_expediente_por_bl: {
        Args: { _bl_master: string; _tipo_op: string }
        Returns: string
      }
      restore_record: {
        Args: { _id: string; _table: string }
        Returns: undefined
      }
      show_limit: { Args: never; Returns: number }
      show_trgm: { Args: { "": string }; Returns: string[] }
      sidebar_alert_counts: {
        Args: never
        Returns: {
          embarques_demora: number
          facturas_vencidas: number
        }[]
      }
      sincronizar_contenedores_embarque: {
        Args: { p_contenedores: Json; p_embarque_id: string }
        Returns: {
          bl_house: string
          created_at: string
          deleted_at: string | null
          deleted_by: string | null
          embarque_id: string
          id: string
          numero_contenedor: string
          orden: number
          organization_id: string
          peso_kg: number
          piezas: number
          tipo_contenedor: string
          updated_at: string
          volumen_m3: number
        }[]
        SetofOptions: {
          from: "*"
          to: "embarque_contenedores"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      soft_delete_record: {
        Args: { _id: string; _table: string }
        Returns: undefined
      }
    }
    Enums: {
      app_role:
        | "admin"
        | "operador"
        | "viewer"
        | "super_admin"
        | "cliente"
        | "vendedor"
      crm_actividad_tipo: "llamada" | "email" | "reunion" | "tarea" | "nota"
      crm_entidad_tipo: "lead" | "oportunidad" | "cliente" | "contacto"
      crm_etapa_tipo: "abierta" | "ganada" | "perdida"
      crm_lead_estado:
        | "Nuevo"
        | "Contactado"
        | "Calificado"
        | "Descalificado"
        | "Convertido"
      crm_lead_fuente:
        | "Web"
        | "Referido"
        | "Campaña"
        | "Llamada en frío"
        | "Evento"
        | "Otro"
      estado_cotizacion:
        | "Borrador"
        | "Enviada"
        | "Aceptada"
        | "Rechazada"
        | "Vencida"
        | "En operación"
      estado_documento: "Pendiente" | "Recibido" | "Validado"
      estado_embarque:
        | "Cotización"
        | "Borrador"
        | "Confirmado"
        | "En Tránsito"
        | "Llegada"
        | "En Proceso"
        | "Cerrado"
        | "En Aduana"
        | "Entregado"
        | "Cancelado"
        | "Arribo"
        | "EIR"
      estado_factura:
        | "Borrador"
        | "Emitida"
        | "Pagada"
        | "Vencida"
        | "Cancelada"
        | "Parcialmente pagada"
      estado_hallazgo_revision: "pendiente" | "en_progreso" | "revisado"
      estado_liquidacion: "Pendiente" | "Pagado"
      estado_nota_credito: "Borrador" | "Aprobada" | "Aplicada" | "Cancelada"
      estado_nota_credito_proveedor:
        | "Borrador"
        | "Aprobada"
        | "Aplicada"
        | "Cancelada"
      estado_proforma: "Pendiente" | "Facturada" | "Cancelada"
      estado_proveedor_factura: "Borrador" | "Vigente" | "Pagada" | "Cancelada"
      incoterm:
        | "EXW"
        | "FOB"
        | "CIF"
        | "DAP"
        | "DDP"
        | "FCA"
        | "CFR"
        | "CPT"
        | "CIP"
        | "DAT"
        | "N/A"
      modo_transporte: "Marítimo" | "Aéreo" | "Terrestre" | "Multimodal"
      moneda: "MXN" | "USD" | "EUR"
      motivo_nota_credito:
        | "Descuento"
        | "Error"
        | "Devolucion"
        | "Bonificacion"
        | "Otro"
      motivo_nota_credito_proveedor:
        | "Devolucion"
        | "Bonificacion"
        | "Descuento"
        | "ErrorFacturacion"
        | "Cancelacion"
        | "Otro"
      origen_proveedor: "Nacional" | "Extranjero"
      tipo_contacto: "Proveedor" | "Exportador" | "Importador"
      tipo_evento_tracking:
        | "Zarpe"
        | "Transbordo"
        | "Arribo a Puerto"
        | "Descarga"
        | "Despacho Aduanal"
        | "Liberación"
        | "En Ruta Terrestre"
        | "Entrega"
        | "Demora"
        | "Inspección"
        | "Otro"
      tipo_nota: "nota" | "cambio_estado" | "documento" | "factura" | "sistema"
      tipo_operacion:
        | "Importación"
        | "Exportación"
        | "Nacional"
        | "Cross Trade"
        | "Intra USA"
      tipo_proveedor:
        | "Naviera"
        | "Aerolínea"
        | "Transportista"
        | "Agente Aduanal"
        | "Agente de Carga"
        | "Aseguradora"
        | "Custodia"
        | "Almacenes"
        | "Acondicionamiento de Carga"
        | "Materiales Peligrosos"
      tipo_servicio_maritimo: "FCL" | "LCL"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: [
        "admin",
        "operador",
        "viewer",
        "super_admin",
        "cliente",
        "vendedor",
      ],
      crm_actividad_tipo: ["llamada", "email", "reunion", "tarea", "nota"],
      crm_entidad_tipo: ["lead", "oportunidad", "cliente", "contacto"],
      crm_etapa_tipo: ["abierta", "ganada", "perdida"],
      crm_lead_estado: [
        "Nuevo",
        "Contactado",
        "Calificado",
        "Descalificado",
        "Convertido",
      ],
      crm_lead_fuente: [
        "Web",
        "Referido",
        "Campaña",
        "Llamada en frío",
        "Evento",
        "Otro",
      ],
      estado_cotizacion: [
        "Borrador",
        "Enviada",
        "Aceptada",
        "Rechazada",
        "Vencida",
        "En operación",
      ],
      estado_documento: ["Pendiente", "Recibido", "Validado"],
      estado_embarque: [
        "Cotización",
        "Borrador",
        "Confirmado",
        "En Tránsito",
        "Llegada",
        "En Proceso",
        "Cerrado",
        "En Aduana",
        "Entregado",
        "Cancelado",
        "Arribo",
        "EIR",
      ],
      estado_factura: [
        "Borrador",
        "Emitida",
        "Pagada",
        "Vencida",
        "Cancelada",
        "Parcialmente pagada",
      ],
      estado_hallazgo_revision: ["pendiente", "en_progreso", "revisado"],
      estado_liquidacion: ["Pendiente", "Pagado"],
      estado_nota_credito: ["Borrador", "Aprobada", "Aplicada", "Cancelada"],
      estado_nota_credito_proveedor: [
        "Borrador",
        "Aprobada",
        "Aplicada",
        "Cancelada",
      ],
      estado_proforma: ["Pendiente", "Facturada", "Cancelada"],
      estado_proveedor_factura: ["Borrador", "Vigente", "Pagada", "Cancelada"],
      incoterm: [
        "EXW",
        "FOB",
        "CIF",
        "DAP",
        "DDP",
        "FCA",
        "CFR",
        "CPT",
        "CIP",
        "DAT",
        "N/A",
      ],
      modo_transporte: ["Marítimo", "Aéreo", "Terrestre", "Multimodal"],
      moneda: ["MXN", "USD", "EUR"],
      motivo_nota_credito: [
        "Descuento",
        "Error",
        "Devolucion",
        "Bonificacion",
        "Otro",
      ],
      motivo_nota_credito_proveedor: [
        "Devolucion",
        "Bonificacion",
        "Descuento",
        "ErrorFacturacion",
        "Cancelacion",
        "Otro",
      ],
      origen_proveedor: ["Nacional", "Extranjero"],
      tipo_contacto: ["Proveedor", "Exportador", "Importador"],
      tipo_evento_tracking: [
        "Zarpe",
        "Transbordo",
        "Arribo a Puerto",
        "Descarga",
        "Despacho Aduanal",
        "Liberación",
        "En Ruta Terrestre",
        "Entrega",
        "Demora",
        "Inspección",
        "Otro",
      ],
      tipo_nota: ["nota", "cambio_estado", "documento", "factura", "sistema"],
      tipo_operacion: [
        "Importación",
        "Exportación",
        "Nacional",
        "Cross Trade",
        "Intra USA",
      ],
      tipo_proveedor: [
        "Naviera",
        "Aerolínea",
        "Transportista",
        "Agente Aduanal",
        "Agente de Carga",
        "Aseguradora",
        "Custodia",
        "Almacenes",
        "Acondicionamiento de Carga",
        "Materiales Peligrosos",
      ],
      tipo_servicio_maritimo: ["FCL", "LCL"],
    },
  },
} as const
