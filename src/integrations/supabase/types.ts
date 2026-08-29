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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      agente_users: {
        Row: {
          agente_id: string
          created_at: string
          id: string
          organization_id: string
          user_id: string
        }
        Insert: {
          agente_id: string
          created_at?: string
          id?: string
          organization_id: string
          user_id: string
        }
        Update: {
          agente_id?: string
          created_at?: string
          id?: string
          organization_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "agente_users_agente_id_fkey"
            columns: ["agente_id"]
            isOneToOne: false
            referencedRelation: "costeo_agentes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agente_users_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
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
      anticipos_aplicaciones: {
        Row: {
          anticipo_id: string
          created_at: string
          created_by: string | null
          deleted_at: string | null
          deleted_by: string | null
          fecha_aplicacion: string
          id: string
          moneda_aplicada: Database["public"]["Enums"]["moneda"]
          monto_aplicado: number
          organization_id: string
          pago_proveedor_id: string
          proveedor_factura_id: string
          updated_at: string
        }
        Insert: {
          anticipo_id: string
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          fecha_aplicacion?: string
          id?: string
          moneda_aplicada: Database["public"]["Enums"]["moneda"]
          monto_aplicado: number
          organization_id: string
          pago_proveedor_id: string
          proveedor_factura_id: string
          updated_at?: string
        }
        Update: {
          anticipo_id?: string
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          fecha_aplicacion?: string
          id?: string
          moneda_aplicada?: Database["public"]["Enums"]["moneda"]
          monto_aplicado?: number
          organization_id?: string
          pago_proveedor_id?: string
          proveedor_factura_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "anticipos_aplicaciones_anticipo_id_fkey"
            columns: ["anticipo_id"]
            isOneToOne: false
            referencedRelation: "anticipos_proveedor"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "anticipos_aplicaciones_pago_proveedor_id_fkey"
            columns: ["pago_proveedor_id"]
            isOneToOne: false
            referencedRelation: "pagos_proveedor"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "anticipos_aplicaciones_proveedor_factura_id_fkey"
            columns: ["proveedor_factura_id"]
            isOneToOne: false
            referencedRelation: "cxp_alertas_vencimiento"
            referencedColumns: ["proveedor_factura_id"]
          },
          {
            foreignKeyName: "anticipos_aplicaciones_proveedor_factura_id_fkey"
            columns: ["proveedor_factura_id"]
            isOneToOne: false
            referencedRelation: "proveedor_facturas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "anticipos_aplicaciones_proveedor_factura_id_fkey"
            columns: ["proveedor_factura_id"]
            isOneToOne: false
            referencedRelation: "v_proveedor_facturas_saldo"
            referencedColumns: ["proveedor_factura_id"]
          },
        ]
      }
      anticipos_proveedor: {
        Row: {
          created_at: string
          created_by: string | null
          cuenta_bancaria_id: string | null
          deleted_at: string | null
          deleted_by: string | null
          devuelto_at: string | null
          devuelto_by: string | null
          embarque_id: string | null
          estado: string
          fecha_anticipo: string
          id: string
          metodo_pago: string | null
          moneda: Database["public"]["Enums"]["moneda"]
          monto: number
          monto_devuelto: number | null
          motivo_cancelacion: string | null
          motivo_devolucion: string | null
          notas: string | null
          organization_id: string
          proveedor_id: string
          referencia: string | null
          saldo_disponible: number
          tipo_cambio_usd: number | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          cuenta_bancaria_id?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          devuelto_at?: string | null
          devuelto_by?: string | null
          embarque_id?: string | null
          estado?: string
          fecha_anticipo?: string
          id?: string
          metodo_pago?: string | null
          moneda?: Database["public"]["Enums"]["moneda"]
          monto: number
          monto_devuelto?: number | null
          motivo_cancelacion?: string | null
          motivo_devolucion?: string | null
          notas?: string | null
          organization_id: string
          proveedor_id: string
          referencia?: string | null
          saldo_disponible: number
          tipo_cambio_usd?: number | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          cuenta_bancaria_id?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          devuelto_at?: string | null
          devuelto_by?: string | null
          embarque_id?: string | null
          estado?: string
          fecha_anticipo?: string
          id?: string
          metodo_pago?: string | null
          moneda?: Database["public"]["Enums"]["moneda"]
          monto?: number
          monto_devuelto?: number | null
          motivo_cancelacion?: string | null
          motivo_devolucion?: string | null
          notas?: string | null
          organization_id?: string
          proveedor_id?: string
          referencia?: string | null
          saldo_disponible?: number
          tipo_cambio_usd?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "anticipos_proveedor_cuenta_bancaria_id_fkey"
            columns: ["cuenta_bancaria_id"]
            isOneToOne: false
            referencedRelation: "cuentas_bancarias"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "anticipos_proveedor_embarque_id_fkey"
            columns: ["embarque_id"]
            isOneToOne: false
            referencedRelation: "embarques"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "anticipos_proveedor_proveedor_id_fkey"
            columns: ["proveedor_id"]
            isOneToOne: false
            referencedRelation: "proveedores"
            referencedColumns: ["id"]
          },
        ]
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
          revisado_at: string | null
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
          revisado_at?: string | null
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
          revisado_at?: string | null
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
      bbva_movimientos: {
        Row: {
          abono: number
          anticipo_proveedor_id: string | null
          cargo: number
          concepto: string
          conciliado_at: string | null
          conciliado_por: string | null
          cuenta_bancaria_id: string
          deleted_at: string | null
          deleted_by: string | null
          estado_conciliacion: Database["public"]["Enums"]["estado_conciliacion"]
          fecha: string
          hash_dedupe: string
          id: string
          importado_en: string
          importado_por: string | null
          motivo_ignorar: string
          organization_id: string
          pago_factura_id: string | null
          pago_factura_lote_id: string | null
          pago_proveedor_id: string | null
          pago_proveedor_lote_id: string | null
          referencia: string
          saldo: number | null
          traspaso_id: string | null
        }
        Insert: {
          abono?: number
          anticipo_proveedor_id?: string | null
          cargo?: number
          concepto?: string
          conciliado_at?: string | null
          conciliado_por?: string | null
          cuenta_bancaria_id: string
          deleted_at?: string | null
          deleted_by?: string | null
          estado_conciliacion?: Database["public"]["Enums"]["estado_conciliacion"]
          fecha: string
          hash_dedupe: string
          id?: string
          importado_en?: string
          importado_por?: string | null
          motivo_ignorar?: string
          organization_id?: string
          pago_factura_id?: string | null
          pago_factura_lote_id?: string | null
          pago_proveedor_id?: string | null
          pago_proveedor_lote_id?: string | null
          referencia?: string
          saldo?: number | null
          traspaso_id?: string | null
        }
        Update: {
          abono?: number
          anticipo_proveedor_id?: string | null
          cargo?: number
          concepto?: string
          conciliado_at?: string | null
          conciliado_por?: string | null
          cuenta_bancaria_id?: string
          deleted_at?: string | null
          deleted_by?: string | null
          estado_conciliacion?: Database["public"]["Enums"]["estado_conciliacion"]
          fecha?: string
          hash_dedupe?: string
          id?: string
          importado_en?: string
          importado_por?: string | null
          motivo_ignorar?: string
          organization_id?: string
          pago_factura_id?: string | null
          pago_factura_lote_id?: string | null
          pago_proveedor_id?: string | null
          pago_proveedor_lote_id?: string | null
          referencia?: string
          saldo?: number | null
          traspaso_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "bbva_movimientos_anticipo_proveedor_id_fkey"
            columns: ["anticipo_proveedor_id"]
            isOneToOne: false
            referencedRelation: "anticipos_proveedor"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bbva_movimientos_cuenta_bancaria_id_fkey"
            columns: ["cuenta_bancaria_id"]
            isOneToOne: false
            referencedRelation: "cuentas_bancarias"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bbva_movimientos_pago_factura_lote_id_fkey"
            columns: ["pago_factura_lote_id"]
            isOneToOne: false
            referencedRelation: "pagos_factura_lote"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bbva_movimientos_pago_proveedor_id_fkey"
            columns: ["pago_proveedor_id"]
            isOneToOne: false
            referencedRelation: "pagos_proveedor"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bbva_movimientos_pago_proveedor_lote_id_fkey"
            columns: ["pago_proveedor_lote_id"]
            isOneToOne: false
            referencedRelation: "pagos_proveedor_lote"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bbva_movimientos_traspaso_id_fkey"
            columns: ["traspaso_id"]
            isOneToOne: false
            referencedRelation: "traspasos_bancarios"
            referencedColumns: ["id"]
          },
        ]
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
          usuario_id: string | null
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
          usuario_id?: string | null
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
          usuario_id?: string | null
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
      catalogo_claves_sat: {
        Row: {
          activo: boolean
          clave_sat: string
          clave_unidad_sat: string
          created_at: string
          id: string
          nombre_unidad: string | null
          notas: string | null
          organization_id: string
          patron: string
          prioridad: number
          tasa_iva_default: number | null
          tipo_iva: string
          updated_at: string
        }
        Insert: {
          activo?: boolean
          clave_sat: string
          clave_unidad_sat?: string
          created_at?: string
          id?: string
          nombre_unidad?: string | null
          notas?: string | null
          organization_id: string
          patron: string
          prioridad?: number
          tasa_iva_default?: number | null
          tipo_iva?: string
          updated_at?: string
        }
        Update: {
          activo?: boolean
          clave_sat?: string
          clave_unidad_sat?: string
          created_at?: string
          id?: string
          nombre_unidad?: string | null
          notas?: string | null
          organization_id?: string
          patron?: string
          prioridad?: number
          tasa_iva_default?: number | null
          tipo_iva?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "catalogo_claves_sat_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      cierre_embarque_log: {
        Row: {
          accion: string
          created_at: string
          embarque_id: string
          id: string
          motivo: string | null
          organization_id: string | null
          snapshot: Json | null
          usuario_id: string | null
        }
        Insert: {
          accion: string
          created_at?: string
          embarque_id: string
          id?: string
          motivo?: string | null
          organization_id?: string | null
          snapshot?: Json | null
          usuario_id?: string | null
        }
        Update: {
          accion?: string
          created_at?: string
          embarque_id?: string
          id?: string
          motivo?: string | null
          organization_id?: string | null
          snapshot?: Json | null
          usuario_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "cierre_embarque_log_embarque_id_fkey"
            columns: ["embarque_id"]
            isOneToOne: false
            referencedRelation: "embarques"
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
      cliente_documentos: {
        Row: {
          archivo: string
          cliente_id: string
          created_at: string
          deleted_at: string | null
          deleted_by: string | null
          fecha_documento: string | null
          fecha_vencimiento: string | null
          id: string
          mime_type: string | null
          nombre: string
          notas: string | null
          organization_id: string
          tamano_bytes: number | null
          tipo: string
          updated_at: string
          uploaded_by: string | null
        }
        Insert: {
          archivo: string
          cliente_id: string
          created_at?: string
          deleted_at?: string | null
          deleted_by?: string | null
          fecha_documento?: string | null
          fecha_vencimiento?: string | null
          id?: string
          mime_type?: string | null
          nombre: string
          notas?: string | null
          organization_id: string
          tamano_bytes?: number | null
          tipo: string
          updated_at?: string
          uploaded_by?: string | null
        }
        Update: {
          archivo?: string
          cliente_id?: string
          created_at?: string
          deleted_at?: string | null
          deleted_by?: string | null
          fecha_documento?: string | null
          fecha_vencimiento?: string | null
          id?: string
          mime_type?: string | null
          nombre?: string
          notas?: string | null
          organization_id?: string
          tamano_bytes?: number | null
          tipo?: string
          updated_at?: string
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "cliente_documentos_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cliente_documentos_organization_id_fkey"
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
          codigo_postal: string | null
          contacto: string
          cp: string
          created_at: string
          deleted_at: string | null
          deleted_by: string | null
          dias_credito: number | null
          direccion: string
          email: string
          email_cc_default: string[] | null
          email_destinatarios_default: string[] | null
          estado: string
          forma_pago_default: string | null
          id: string
          limite_credito_mxn: number | null
          metodo_pago_default: string | null
          nombre: string
          organization_id: string
          regimen_fiscal: string | null
          requiere_autorizacion_cotizacion: boolean
          requiere_autorizacion_proforma: boolean
          rfc: string
          sin_comision: boolean
          telefono: string
          updated_at: string
          uso_cfdi_default: string | null
        }
        Insert: {
          ciudad?: string
          codigo_postal?: string | null
          contacto?: string
          cp?: string
          created_at?: string
          deleted_at?: string | null
          deleted_by?: string | null
          dias_credito?: number | null
          direccion?: string
          email?: string
          email_cc_default?: string[] | null
          email_destinatarios_default?: string[] | null
          estado?: string
          forma_pago_default?: string | null
          id?: string
          limite_credito_mxn?: number | null
          metodo_pago_default?: string | null
          nombre: string
          organization_id?: string
          regimen_fiscal?: string | null
          requiere_autorizacion_cotizacion?: boolean
          requiere_autorizacion_proforma?: boolean
          rfc?: string
          sin_comision?: boolean
          telefono?: string
          updated_at?: string
          uso_cfdi_default?: string | null
        }
        Update: {
          ciudad?: string
          codigo_postal?: string | null
          contacto?: string
          cp?: string
          created_at?: string
          deleted_at?: string | null
          deleted_by?: string | null
          dias_credito?: number | null
          direccion?: string
          email?: string
          email_cc_default?: string[] | null
          email_destinatarios_default?: string[] | null
          estado?: string
          forma_pago_default?: string | null
          id?: string
          limite_credito_mxn?: number | null
          metodo_pago_default?: string | null
          nombre?: string
          organization_id?: string
          regimen_fiscal?: string | null
          requiere_autorizacion_cotizacion?: boolean
          requiere_autorizacion_proforma?: boolean
          rfc?: string
          sin_comision?: boolean
          telefono?: string
          updated_at?: string
          uso_cfdi_default?: string | null
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
      cobranza_seguimiento: {
        Row: {
          comentario: string | null
          created_at: string
          factura_id: string
          fecha: string
          fecha_promesa: string | null
          id: string
          monto_promesa: number | null
          organization_id: string
          tipo: string
          updated_at: string
          usuario_id: string | null
        }
        Insert: {
          comentario?: string | null
          created_at?: string
          factura_id: string
          fecha?: string
          fecha_promesa?: string | null
          id?: string
          monto_promesa?: number | null
          organization_id: string
          tipo: string
          updated_at?: string
          usuario_id?: string | null
        }
        Update: {
          comentario?: string | null
          created_at?: string
          factura_id?: string
          fecha?: string
          fecha_promesa?: string | null
          id?: string
          monto_promesa?: number | null
          organization_id?: string
          tipo?: string
          updated_at?: string
          usuario_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "cobranza_seguimiento_factura_id_fkey"
            columns: ["factura_id"]
            isOneToOne: false
            referencedRelation: "facturas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cobranza_seguimiento_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      comisiones_devengadas: {
        Row: {
          calculo_snapshot: Json | null
          comision_mxn: number
          created_at: string
          definitiva: boolean
          deleted_at: string | null
          deleted_by: string | null
          embarque_id: string | null
          estado: Database["public"]["Enums"]["estado_comision"]
          factura_id: string
          id: string
          liquidacion_id: string | null
          monto_cobrado_mxn: number
          nota: string | null
          organization_id: string
          pago_factura_id: string
          pnl_base: number | null
          porcentaje_aplicado: number
          updated_at: string
          utilidad_prorrateada_mxn: number
          vendedora_id: string | null
        }
        Insert: {
          calculo_snapshot?: Json | null
          comision_mxn?: number
          created_at?: string
          definitiva?: boolean
          deleted_at?: string | null
          deleted_by?: string | null
          embarque_id?: string | null
          estado?: Database["public"]["Enums"]["estado_comision"]
          factura_id: string
          id?: string
          liquidacion_id?: string | null
          monto_cobrado_mxn?: number
          nota?: string | null
          organization_id: string
          pago_factura_id: string
          pnl_base?: number | null
          porcentaje_aplicado?: number
          updated_at?: string
          utilidad_prorrateada_mxn?: number
          vendedora_id?: string | null
        }
        Update: {
          calculo_snapshot?: Json | null
          comision_mxn?: number
          created_at?: string
          definitiva?: boolean
          deleted_at?: string | null
          deleted_by?: string | null
          embarque_id?: string | null
          estado?: Database["public"]["Enums"]["estado_comision"]
          factura_id?: string
          id?: string
          liquidacion_id?: string | null
          monto_cobrado_mxn?: number
          nota?: string | null
          organization_id?: string
          pago_factura_id?: string
          pnl_base?: number | null
          porcentaje_aplicado?: number
          updated_at?: string
          utilidad_prorrateada_mxn?: number
          vendedora_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "comisiones_devengadas_embarque_id_fkey"
            columns: ["embarque_id"]
            isOneToOne: false
            referencedRelation: "embarques"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comisiones_devengadas_factura_id_fkey"
            columns: ["factura_id"]
            isOneToOne: false
            referencedRelation: "facturas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comisiones_devengadas_pago_factura_id_fkey"
            columns: ["pago_factura_id"]
            isOneToOne: true
            referencedRelation: "pagos_factura"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comisiones_devengadas_pago_factura_id_fkey"
            columns: ["pago_factura_id"]
            isOneToOne: true
            referencedRelation: "v_pagos_rep_pendientes"
            referencedColumns: ["pago_id"]
          },
        ]
      }
      comisiones_excepciones: {
        Row: {
          activa: boolean
          cliente_id: string | null
          created_at: string
          created_by: string | null
          deleted_at: string | null
          embarque_id: string | null
          id: string
          motivo: string | null
          organization_id: string
          porcentaje: number
          updated_at: string
          vendedora_id: string
        }
        Insert: {
          activa?: boolean
          cliente_id?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          embarque_id?: string | null
          id?: string
          motivo?: string | null
          organization_id: string
          porcentaje: number
          updated_at?: string
          vendedora_id: string
        }
        Update: {
          activa?: boolean
          cliente_id?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          embarque_id?: string | null
          id?: string
          motivo?: string | null
          organization_id?: string
          porcentaje?: number
          updated_at?: string
          vendedora_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "comisiones_excepciones_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comisiones_excepciones_embarque_id_fkey"
            columns: ["embarque_id"]
            isOneToOne: false
            referencedRelation: "embarques"
            referencedColumns: ["id"]
          },
        ]
      }
      comisiones_recalculo_pendiente: {
        Row: {
          created_at: string
          etapa: string
          id: string
          intentos: number
          motivo: string
          organization_id: string
          pago_factura_id: string
          resuelto_at: string | null
          resultado_recalculo: string | null
          sqlerrm_text: string
          sqlstate_code: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          etapa: string
          id?: string
          intentos?: number
          motivo?: string
          organization_id: string
          pago_factura_id: string
          resuelto_at?: string | null
          resultado_recalculo?: string | null
          sqlerrm_text?: string
          sqlstate_code?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          etapa?: string
          id?: string
          intentos?: number
          motivo?: string
          organization_id?: string
          pago_factura_id?: string
          resuelto_at?: string | null
          resultado_recalculo?: string | null
          sqlerrm_text?: string
          sqlstate_code?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "comisiones_recalculo_pendiente_pago_factura_id_fkey"
            columns: ["pago_factura_id"]
            isOneToOne: false
            referencedRelation: "pagos_factura"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comisiones_recalculo_pendiente_pago_factura_id_fkey"
            columns: ["pago_factura_id"]
            isOneToOne: false
            referencedRelation: "v_pagos_rep_pendientes"
            referencedColumns: ["pago_id"]
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
          origen: string
          proveedor_id: string | null
          proveedor_nombre: string
          referencia_pago: string | null
          tasa_iva_aplicada: number
          updated_at: string | null
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
          origen?: string
          proveedor_id?: string | null
          proveedor_nombre?: string
          referencia_pago?: string | null
          tasa_iva_aplicada?: number
          updated_at?: string | null
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
          origen?: string
          proveedor_id?: string | null
          proveedor_nombre?: string
          referencia_pago?: string | null
          tasa_iva_aplicada?: number
          updated_at?: string | null
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
          clave_sat: string
          clave_unidad: string
          created_at: string
          deleted_at: string | null
          deleted_by: string | null
          descripcion: string
          embarque_id: string | null
          factura_id: string
          id: string
          moneda: Database["public"]["Enums"]["moneda"]
          monto_ret_isr: number
          monto_ret_iva: number
          organization_id: string
          precio_unitario: number
          proforma_id_origen: string | null
          tasa_iva_aplicada: number | null
          tasa_ret_isr: number
          tasa_ret_iva: number
          tipo_iva: string
          total: number
          updated_at: string | null
        }
        Insert: {
          cantidad?: number
          clave_sat?: string
          clave_unidad?: string
          created_at?: string
          deleted_at?: string | null
          deleted_by?: string | null
          descripcion: string
          embarque_id?: string | null
          factura_id: string
          id?: string
          moneda?: Database["public"]["Enums"]["moneda"]
          monto_ret_isr?: number
          monto_ret_iva?: number
          organization_id?: string
          precio_unitario?: number
          proforma_id_origen?: string | null
          tasa_iva_aplicada?: number | null
          tasa_ret_isr?: number
          tasa_ret_iva?: number
          tipo_iva?: string
          total?: number
          updated_at?: string | null
        }
        Update: {
          cantidad?: number
          clave_sat?: string
          clave_unidad?: string
          created_at?: string
          deleted_at?: string | null
          deleted_by?: string | null
          descripcion?: string
          embarque_id?: string | null
          factura_id?: string
          id?: string
          moneda?: Database["public"]["Enums"]["moneda"]
          monto_ret_isr?: number
          monto_ret_iva?: number
          organization_id?: string
          precio_unitario?: number
          proforma_id_origen?: string | null
          tasa_iva_aplicada?: number | null
          tasa_ret_isr?: number
          tasa_ret_iva?: number
          tipo_iva?: string
          total?: number
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "conceptos_factura_embarque_id_fkey"
            columns: ["embarque_id"]
            isOneToOne: false
            referencedRelation: "embarques"
            referencedColumns: ["id"]
          },
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
          {
            foreignKeyName: "conceptos_factura_proforma_id_origen_fkey"
            columns: ["proforma_id_origen"]
            isOneToOne: false
            referencedRelation: "proformas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conceptos_factura_proforma_id_origen_fkey"
            columns: ["proforma_id_origen"]
            isOneToOne: false
            referencedRelation: "v_proforma_factura_link"
            referencedColumns: ["proforma_id"]
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
          origen: string
          precio_unitario: number
          proforma_id: string | null
          tasa_iva_aplicada: number
          total: number
          updated_at: string | null
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
          origen?: string
          precio_unitario?: number
          proforma_id?: string | null
          tasa_iva_aplicada?: number
          total?: number
          updated_at?: string | null
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
          origen?: string
          precio_unitario?: number
          proforma_id?: string | null
          tasa_iva_aplicada?: number
          total?: number
          updated_at?: string | null
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
          {
            foreignKeyName: "conceptos_venta_proforma_id_fkey"
            columns: ["proforma_id"]
            isOneToOne: false
            referencedRelation: "v_proforma_factura_link"
            referencedColumns: ["proforma_id"]
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
          updated_at: string | null
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
          updated_at?: string | null
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
          updated_at?: string | null
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
      costeo_agentes: {
        Row: {
          activo: boolean
          contacto_tarifario: string | null
          created_at: string
          dias_credito: number
          email: string | null
          id: string
          nombre: string
          notas: string | null
          organization_id: string
          pais: string
          proveedor_id: string
          updated_at: string
        }
        Insert: {
          activo?: boolean
          contacto_tarifario?: string | null
          created_at?: string
          dias_credito?: number
          email?: string | null
          id?: string
          nombre: string
          notas?: string | null
          organization_id: string
          pais?: string
          proveedor_id: string
          updated_at?: string
        }
        Update: {
          activo?: boolean
          contacto_tarifario?: string | null
          created_at?: string
          dias_credito?: number
          email?: string | null
          id?: string
          nombre?: string
          notas?: string | null
          organization_id?: string
          pais?: string
          proveedor_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "costeo_agentes_proveedor_id_fkey"
            columns: ["proveedor_id"]
            isOneToOne: false
            referencedRelation: "proveedores"
            referencedColumns: ["id"]
          },
        ]
      }
      costeo_demoras_venta_tarifa: {
        Row: {
          created_at: string
          desde_dia: number
          hasta_dia: number | null
          id: string
          monto_por_dia_usd: number
          notas: string | null
          organization_id: string
          tipo_contenedor_id: string
          updated_at: string
          vigente_desde: string
          vigente_hasta: string | null
        }
        Insert: {
          created_at?: string
          desde_dia: number
          hasta_dia?: number | null
          id?: string
          monto_por_dia_usd: number
          notas?: string | null
          organization_id?: string
          tipo_contenedor_id: string
          updated_at?: string
          vigente_desde?: string
          vigente_hasta?: string | null
        }
        Update: {
          created_at?: string
          desde_dia?: number
          hasta_dia?: number | null
          id?: string
          monto_por_dia_usd?: number
          notas?: string | null
          organization_id?: string
          tipo_contenedor_id?: string
          updated_at?: string
          vigente_desde?: string
          vigente_hasta?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "costeo_demoras_venta_tarifa_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "costeo_demoras_venta_tarifa_tipo_contenedor_id_fkey"
            columns: ["tipo_contenedor_id"]
            isOneToOne: false
            referencedRelation: "tipos_contenedor"
            referencedColumns: ["id"]
          },
        ]
      }
      costeo_naviera_demoras_tarifa: {
        Row: {
          created_at: string
          desde_dia: number
          hasta_dia: number | null
          id: string
          moneda: string
          monto_por_dia: number
          naviera_condicion_id: string
          organization_id: string
          tipo_contenedor_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          desde_dia: number
          hasta_dia?: number | null
          id?: string
          moneda?: string
          monto_por_dia: number
          naviera_condicion_id: string
          organization_id: string
          tipo_contenedor_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          desde_dia?: number
          hasta_dia?: number | null
          id?: string
          moneda?: string
          monto_por_dia?: number
          naviera_condicion_id?: string
          organization_id?: string
          tipo_contenedor_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "costeo_demoras_tarifa_org_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "costeo_naviera_demoras_tarifa_naviera_condicion_id_fkey"
            columns: ["naviera_condicion_id"]
            isOneToOne: false
            referencedRelation: "costeo_navieras_condiciones"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "costeo_naviera_demoras_tarifa_naviera_condicion_id_fkey"
            columns: ["naviera_condicion_id"]
            isOneToOne: false
            referencedRelation: "costeo_tarifas_vigentes_v"
            referencedColumns: ["naviera_condicion_id"]
          },
          {
            foreignKeyName: "costeo_naviera_demoras_tarifa_tipo_contenedor_id_fkey"
            columns: ["tipo_contenedor_id"]
            isOneToOne: false
            referencedRelation: "tipos_contenedor"
            referencedColumns: ["id"]
          },
        ]
      }
      costeo_navieras_condiciones: {
        Row: {
          carta_garantia_folio: string | null
          carta_garantia_notas: string | null
          carta_garantia_vigente_hasta: string | null
          created_at: string
          deposito_contenedor_usd: number
          dias_libres_demoras_default: number
          frecuencia: string | null
          id: string
          moneda_demoras: string
          naviera_id: string
          notas: string | null
          organization_id: string
          proveedor_id: string
          tiene_carta_garantia: boolean
          updated_at: string
        }
        Insert: {
          carta_garantia_folio?: string | null
          carta_garantia_notas?: string | null
          carta_garantia_vigente_hasta?: string | null
          created_at?: string
          deposito_contenedor_usd?: number
          dias_libres_demoras_default?: number
          frecuencia?: string | null
          id?: string
          moneda_demoras?: string
          naviera_id: string
          notas?: string | null
          organization_id: string
          proveedor_id: string
          tiene_carta_garantia?: boolean
          updated_at?: string
        }
        Update: {
          carta_garantia_folio?: string | null
          carta_garantia_notas?: string | null
          carta_garantia_vigente_hasta?: string | null
          created_at?: string
          deposito_contenedor_usd?: number
          dias_libres_demoras_default?: number
          frecuencia?: string | null
          id?: string
          moneda_demoras?: string
          naviera_id?: string
          notas?: string | null
          organization_id?: string
          proveedor_id?: string
          tiene_carta_garantia?: boolean
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "costeo_navieras_condiciones_naviera_id_fkey"
            columns: ["naviera_id"]
            isOneToOne: false
            referencedRelation: "navieras"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "costeo_navieras_condiciones_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "costeo_navieras_condiciones_proveedor_id_fkey"
            columns: ["proveedor_id"]
            isOneToOne: false
            referencedRelation: "proveedores"
            referencedColumns: ["id"]
          },
        ]
      }
      costeo_rutas: {
        Row: {
          activa: boolean
          created_at: string
          id: string
          organization_id: string
          puerto_destino_id: string
          puerto_origen_id: string
          updated_at: string
        }
        Insert: {
          activa?: boolean
          created_at?: string
          id?: string
          organization_id: string
          puerto_destino_id: string
          puerto_origen_id: string
          updated_at?: string
        }
        Update: {
          activa?: boolean
          created_at?: string
          id?: string
          organization_id?: string
          puerto_destino_id?: string
          puerto_origen_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "costeo_rutas_puerto_destino_id_fkey"
            columns: ["puerto_destino_id"]
            isOneToOne: false
            referencedRelation: "puertos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "costeo_rutas_puerto_origen_id_fkey"
            columns: ["puerto_origen_id"]
            isOneToOne: false
            referencedRelation: "puertos"
            referencedColumns: ["id"]
          },
        ]
      }
      costeo_tarifa_recargos: {
        Row: {
          concepto: string
          created_at: string
          id: string
          incluido_en_total: boolean
          lado: string
          moneda: string
          monto: number
          organization_id: string
          tarifa_id: string
        }
        Insert: {
          concepto: string
          created_at?: string
          id?: string
          incluido_en_total?: boolean
          lado: string
          moneda?: string
          monto?: number
          organization_id: string
          tarifa_id: string
        }
        Update: {
          concepto?: string
          created_at?: string
          id?: string
          incluido_en_total?: boolean
          lado?: string
          moneda?: string
          monto?: number
          organization_id?: string
          tarifa_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "costeo_tarifa_recargos_org_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "costeo_tarifa_recargos_tarifa_id_fkey"
            columns: ["tarifa_id"]
            isOneToOne: false
            referencedRelation: "costeo_tarifas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "costeo_tarifa_recargos_tarifa_id_fkey"
            columns: ["tarifa_id"]
            isOneToOne: false
            referencedRelation: "costeo_tarifas_vigentes_v"
            referencedColumns: ["id"]
          },
        ]
      }
      costeo_tarifas: {
        Row: {
          agente_id: string
          aprobada_en: string | null
          aprobada_por: string | null
          creado_por: string | null
          created_at: string
          dias_libres_almacenaje_lcl: number | null
          dias_libres_demoras: number
          estado: string
          estado_aprobacion: string
          flete_base: number
          frecuencia_override: string | null
          id: string
          moneda: string
          motivo_rechazo: string | null
          naviera_id: string
          notas: string | null
          organization_id: string
          reemplazada_por: string | null
          ruta_id: string
          tipo_contenedor_id: string
          transit_time_dias: number | null
          updated_at: string
          vigente_desde: string
          vigente_hasta: string
        }
        Insert: {
          agente_id: string
          aprobada_en?: string | null
          aprobada_por?: string | null
          creado_por?: string | null
          created_at?: string
          dias_libres_almacenaje_lcl?: number | null
          dias_libres_demoras?: number
          estado?: string
          estado_aprobacion?: string
          flete_base: number
          frecuencia_override?: string | null
          id?: string
          moneda?: string
          motivo_rechazo?: string | null
          naviera_id: string
          notas?: string | null
          organization_id: string
          reemplazada_por?: string | null
          ruta_id: string
          tipo_contenedor_id: string
          transit_time_dias?: number | null
          updated_at?: string
          vigente_desde: string
          vigente_hasta: string
        }
        Update: {
          agente_id?: string
          aprobada_en?: string | null
          aprobada_por?: string | null
          creado_por?: string | null
          created_at?: string
          dias_libres_almacenaje_lcl?: number | null
          dias_libres_demoras?: number
          estado?: string
          estado_aprobacion?: string
          flete_base?: number
          frecuencia_override?: string | null
          id?: string
          moneda?: string
          motivo_rechazo?: string | null
          naviera_id?: string
          notas?: string | null
          organization_id?: string
          reemplazada_por?: string | null
          ruta_id?: string
          tipo_contenedor_id?: string
          transit_time_dias?: number | null
          updated_at?: string
          vigente_desde?: string
          vigente_hasta?: string
        }
        Relationships: [
          {
            foreignKeyName: "costeo_tarifas_agente_id_fkey"
            columns: ["agente_id"]
            isOneToOne: false
            referencedRelation: "costeo_agentes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "costeo_tarifas_naviera_id_fkey"
            columns: ["naviera_id"]
            isOneToOne: false
            referencedRelation: "navieras"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "costeo_tarifas_reemplazada_por_fkey"
            columns: ["reemplazada_por"]
            isOneToOne: false
            referencedRelation: "costeo_tarifas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "costeo_tarifas_reemplazada_por_fkey"
            columns: ["reemplazada_por"]
            isOneToOne: false
            referencedRelation: "costeo_tarifas_vigentes_v"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "costeo_tarifas_ruta_id_fkey"
            columns: ["ruta_id"]
            isOneToOne: false
            referencedRelation: "costeo_rutas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "costeo_tarifas_tipo_contenedor_id_fkey"
            columns: ["tipo_contenedor_id"]
            isOneToOne: false
            referencedRelation: "tipos_contenedor"
            referencedColumns: ["id"]
          },
        ]
      }
      cotizacion_costos: {
        Row: {
          cantidad: number
          concepto: string
          costeo_tarifa_id: string | null
          costeo_tarifa_recargo_id: string | null
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
          costeo_tarifa_id?: string | null
          costeo_tarifa_recargo_id?: string | null
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
          costeo_tarifa_id?: string | null
          costeo_tarifa_recargo_id?: string | null
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
            foreignKeyName: "cotizacion_costos_costeo_tarifa_id_fkey"
            columns: ["costeo_tarifa_id"]
            isOneToOne: false
            referencedRelation: "costeo_tarifas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cotizacion_costos_costeo_tarifa_id_fkey"
            columns: ["costeo_tarifa_id"]
            isOneToOne: false
            referencedRelation: "costeo_tarifas_vigentes_v"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cotizacion_costos_costeo_tarifa_recargo_id_fkey"
            columns: ["costeo_tarifa_recargo_id"]
            isOneToOne: false
            referencedRelation: "costeo_tarifa_recargos"
            referencedColumns: ["id"]
          },
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
      cotizacion_costos_historico: {
        Row: {
          archivada_en: string
          archivada_por: string | null
          cantidad: number
          concepto: string
          costeo_tarifa_id: string | null
          costeo_tarifa_recargo_id: string | null
          costo_total: number | null
          costo_unitario: number
          cotizacion_id: string
          created_at: string
          id: string
          moneda: string
          motivo: string | null
          notas: string
          organization_id: string
          origen_costo_id: string
          porcentaje_profit: number | null
          precio_total: number | null
          precio_venta: number
          profit: number | null
          proveedor: string
          unidad_medida: string
          version: number
        }
        Insert: {
          archivada_en?: string
          archivada_por?: string | null
          cantidad?: number
          concepto: string
          costeo_tarifa_id?: string | null
          costeo_tarifa_recargo_id?: string | null
          costo_total?: number | null
          costo_unitario?: number
          cotizacion_id: string
          created_at?: string
          id?: string
          moneda: string
          motivo?: string | null
          notas?: string
          organization_id: string
          origen_costo_id: string
          porcentaje_profit?: number | null
          precio_total?: number | null
          precio_venta?: number
          profit?: number | null
          proveedor?: string
          unidad_medida?: string
          version: number
        }
        Update: {
          archivada_en?: string
          archivada_por?: string | null
          cantidad?: number
          concepto?: string
          costeo_tarifa_id?: string | null
          costeo_tarifa_recargo_id?: string | null
          costo_total?: number | null
          costo_unitario?: number
          cotizacion_id?: string
          created_at?: string
          id?: string
          moneda?: string
          motivo?: string | null
          notas?: string
          organization_id?: string
          origen_costo_id?: string
          porcentaje_profit?: number | null
          precio_total?: number | null
          precio_venta?: number
          profit?: number | null
          proveedor?: string
          unidad_medida?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "cotizacion_costos_historico_cotizacion_id_fkey"
            columns: ["cotizacion_id"]
            isOneToOne: false
            referencedRelation: "cotizaciones"
            referencedColumns: ["id"]
          },
        ]
      }
      cotizacion_envios: {
        Row: {
          asunto: string | null
          cc: Json
          cotizacion_id: string
          created_at: string
          destinatarios: Json
          enviado_por: string | null
          error: string | null
          estado: string
          id: string
          mensaje: string | null
          organization_id: string
          pdf_link_publico: string | null
          pdf_storage_path: string | null
        }
        Insert: {
          asunto?: string | null
          cc?: Json
          cotizacion_id: string
          created_at?: string
          destinatarios?: Json
          enviado_por?: string | null
          error?: string | null
          estado?: string
          id?: string
          mensaje?: string | null
          organization_id: string
          pdf_link_publico?: string | null
          pdf_storage_path?: string | null
        }
        Update: {
          asunto?: string | null
          cc?: Json
          cotizacion_id?: string
          created_at?: string
          destinatarios?: Json
          enviado_por?: string | null
          error?: string | null
          estado?: string
          id?: string
          mensaje?: string | null
          organization_id?: string
          pdf_link_publico?: string | null
          pdf_storage_path?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "cotizacion_envios_cotizacion_id_fkey"
            columns: ["cotizacion_id"]
            isOneToOne: false
            referencedRelation: "cotizaciones"
            referencedColumns: ["id"]
          },
        ]
      }
      cotizacion_plantillas: {
        Row: {
          created_at: string
          deleted_at: string | null
          descripcion: string | null
          id: string
          nombre: string
          organization_id: string
          payload: Json
          ultima_uso_at: string | null
          updated_at: string
          usuario_id: string | null
          veces_usada: number
          visibilidad: string
        }
        Insert: {
          created_at?: string
          deleted_at?: string | null
          descripcion?: string | null
          id?: string
          nombre: string
          organization_id: string
          payload: Json
          ultima_uso_at?: string | null
          updated_at?: string
          usuario_id?: string | null
          veces_usada?: number
          visibilidad?: string
        }
        Update: {
          created_at?: string
          deleted_at?: string | null
          descripcion?: string | null
          id?: string
          nombre?: string
          organization_id?: string
          payload?: Json
          ultima_uso_at?: string | null
          updated_at?: string
          usuario_id?: string | null
          veces_usada?: number
          visibilidad?: string
        }
        Relationships: [
          {
            foreignKeyName: "cotizacion_plantillas_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      cotizacion_versiones: {
        Row: {
          costos_snapshot: Json
          cotizacion_id: string
          created_at: string
          created_by: string | null
          estado_al_snapshot: string
          folio: string
          id: string
          organization_id: string
          snapshot: Json
          version_num: number
        }
        Insert: {
          costos_snapshot?: Json
          cotizacion_id: string
          created_at?: string
          created_by?: string | null
          estado_al_snapshot: string
          folio: string
          id?: string
          organization_id: string
          snapshot: Json
          version_num: number
        }
        Update: {
          costos_snapshot?: Json
          cotizacion_id?: string
          created_at?: string
          created_by?: string | null
          estado_al_snapshot?: string
          folio?: string
          id?: string
          organization_id?: string
          snapshot?: Json
          version_num?: number
        }
        Relationships: [
          {
            foreignKeyName: "cotizacion_versiones_cotizacion_id_fkey"
            columns: ["cotizacion_id"]
            isOneToOne: false
            referencedRelation: "cotizaciones"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cotizacion_versiones_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      cotizaciones: {
        Row: {
          aceptada_en: string | null
          aceptada_por: string | null
          agente_id: string | null
          carta_garantia: boolean
          cliente_id: string | null
          cliente_nombre: string
          comentario_cliente: string | null
          conceptos_venta: Json
          created_at: string
          created_by: string | null
          deleted_at: string | null
          deleted_by: string | null
          descripcion_adicional: string
          descripcion_mercancia: string
          destino: string
          dias_almacenaje: number
          dias_libres_destino: number
          dimensiones_aereas: Json
          dimensiones_lcl: Json
          duplicada_de_id: string | null
          embarque_id: string | null
          es_prospecto: boolean
          estado: Database["public"]["Enums"]["estado_cotizacion"]
          estado_anterior:
            | Database["public"]["Enums"]["estado_cotizacion"]
            | null
          estado_revalidacion: string
          fecha_aceptacion: string | null
          fecha_envio: string | null
          fecha_rechazo: string | null
          fecha_vigencia: string | null
          folio: string
          frecuencia: string
          id: string
          incoterm: Database["public"]["Enums"]["incoterm"]
          lcl_consolidador_id: string | null
          lcl_dias_libres_almacenaje: number | null
          lcl_minimo_flete: number | null
          lcl_tarifa_wm: number | null
          modalidad_equipo: string | null
          modo: Database["public"]["Enums"]["modo_transporte"]
          moneda: Database["public"]["Enums"]["moneda"]
          msds_archivo: string | null
          naviera_id: string | null
          notas: string | null
          num_contenedores: number
          operador: string
          oportunidad_id: string | null
          organization_id: string
          origen: string
          origen_portal: boolean
          peso_kg: number
          piezas: number
          prospecto_contacto: string
          prospecto_email: string
          prospecto_empresa: string
          prospecto_telefono: string
          punto_intermedio: string | null
          revalidacion_delta_jsonb: Json | null
          revalidacion_resuelta_en: string | null
          revalidacion_solicitada_en: string | null
          ruta_texto: string
          sector_economico: string
          seguro: boolean
          sin_desglose_costos: boolean
          subtotal: number
          tarifa_id: string | null
          tarifa_override: Json
          tarifas_informativas: Json
          tiempo_transito_dias: number | null
          tipo: Database["public"]["Enums"]["tipo_operacion"]
          tipo_carga: string
          tipo_contenedor: string | null
          tipo_documento: string
          tipo_embarque: string
          tipo_movimiento: string
          tipo_peso: string
          tipo_unidad: string | null
          updated_at: string
          validez_propuesta: string | null
          valor_seguro_usd: number
          version: number
          version_aceptada: number | null
          vigencia_desde: string | null
          vigencia_dias: number
          vigencia_hasta: string | null
          volumen_m3: number
        }
        Insert: {
          aceptada_en?: string | null
          aceptada_por?: string | null
          agente_id?: string | null
          carta_garantia?: boolean
          cliente_id?: string | null
          cliente_nombre?: string
          comentario_cliente?: string | null
          conceptos_venta?: Json
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          descripcion_adicional?: string
          descripcion_mercancia?: string
          destino?: string
          dias_almacenaje?: number
          dias_libres_destino?: number
          dimensiones_aereas?: Json
          dimensiones_lcl?: Json
          duplicada_de_id?: string | null
          embarque_id?: string | null
          es_prospecto?: boolean
          estado?: Database["public"]["Enums"]["estado_cotizacion"]
          estado_anterior?:
            | Database["public"]["Enums"]["estado_cotizacion"]
            | null
          estado_revalidacion?: string
          fecha_aceptacion?: string | null
          fecha_envio?: string | null
          fecha_rechazo?: string | null
          fecha_vigencia?: string | null
          folio: string
          frecuencia?: string
          id?: string
          incoterm?: Database["public"]["Enums"]["incoterm"]
          lcl_consolidador_id?: string | null
          lcl_dias_libres_almacenaje?: number | null
          lcl_minimo_flete?: number | null
          lcl_tarifa_wm?: number | null
          modalidad_equipo?: string | null
          modo: Database["public"]["Enums"]["modo_transporte"]
          moneda?: Database["public"]["Enums"]["moneda"]
          msds_archivo?: string | null
          naviera_id?: string | null
          notas?: string | null
          num_contenedores?: number
          operador?: string
          oportunidad_id?: string | null
          organization_id?: string
          origen?: string
          origen_portal?: boolean
          peso_kg?: number
          piezas?: number
          prospecto_contacto?: string
          prospecto_email?: string
          prospecto_empresa?: string
          prospecto_telefono?: string
          punto_intermedio?: string | null
          revalidacion_delta_jsonb?: Json | null
          revalidacion_resuelta_en?: string | null
          revalidacion_solicitada_en?: string | null
          ruta_texto?: string
          sector_economico?: string
          seguro?: boolean
          sin_desglose_costos?: boolean
          subtotal?: number
          tarifa_id?: string | null
          tarifa_override?: Json
          tarifas_informativas?: Json
          tiempo_transito_dias?: number | null
          tipo: Database["public"]["Enums"]["tipo_operacion"]
          tipo_carga?: string
          tipo_contenedor?: string | null
          tipo_documento?: string
          tipo_embarque?: string
          tipo_movimiento?: string
          tipo_peso?: string
          tipo_unidad?: string | null
          updated_at?: string
          validez_propuesta?: string | null
          valor_seguro_usd?: number
          version?: number
          version_aceptada?: number | null
          vigencia_desde?: string | null
          vigencia_dias?: number
          vigencia_hasta?: string | null
          volumen_m3?: number
        }
        Update: {
          aceptada_en?: string | null
          aceptada_por?: string | null
          agente_id?: string | null
          carta_garantia?: boolean
          cliente_id?: string | null
          cliente_nombre?: string
          comentario_cliente?: string | null
          conceptos_venta?: Json
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          descripcion_adicional?: string
          descripcion_mercancia?: string
          destino?: string
          dias_almacenaje?: number
          dias_libres_destino?: number
          dimensiones_aereas?: Json
          dimensiones_lcl?: Json
          duplicada_de_id?: string | null
          embarque_id?: string | null
          es_prospecto?: boolean
          estado?: Database["public"]["Enums"]["estado_cotizacion"]
          estado_anterior?:
            | Database["public"]["Enums"]["estado_cotizacion"]
            | null
          estado_revalidacion?: string
          fecha_aceptacion?: string | null
          fecha_envio?: string | null
          fecha_rechazo?: string | null
          fecha_vigencia?: string | null
          folio?: string
          frecuencia?: string
          id?: string
          incoterm?: Database["public"]["Enums"]["incoterm"]
          lcl_consolidador_id?: string | null
          lcl_dias_libres_almacenaje?: number | null
          lcl_minimo_flete?: number | null
          lcl_tarifa_wm?: number | null
          modalidad_equipo?: string | null
          modo?: Database["public"]["Enums"]["modo_transporte"]
          moneda?: Database["public"]["Enums"]["moneda"]
          msds_archivo?: string | null
          naviera_id?: string | null
          notas?: string | null
          num_contenedores?: number
          operador?: string
          oportunidad_id?: string | null
          organization_id?: string
          origen?: string
          origen_portal?: boolean
          peso_kg?: number
          piezas?: number
          prospecto_contacto?: string
          prospecto_email?: string
          prospecto_empresa?: string
          prospecto_telefono?: string
          punto_intermedio?: string | null
          revalidacion_delta_jsonb?: Json | null
          revalidacion_resuelta_en?: string | null
          revalidacion_solicitada_en?: string | null
          ruta_texto?: string
          sector_economico?: string
          seguro?: boolean
          sin_desglose_costos?: boolean
          subtotal?: number
          tarifa_id?: string | null
          tarifa_override?: Json
          tarifas_informativas?: Json
          tiempo_transito_dias?: number | null
          tipo?: Database["public"]["Enums"]["tipo_operacion"]
          tipo_carga?: string
          tipo_contenedor?: string | null
          tipo_documento?: string
          tipo_embarque?: string
          tipo_movimiento?: string
          tipo_peso?: string
          tipo_unidad?: string | null
          updated_at?: string
          validez_propuesta?: string | null
          valor_seguro_usd?: number
          version?: number
          version_aceptada?: number | null
          vigencia_desde?: string | null
          vigencia_dias?: number
          vigencia_hasta?: string | null
          volumen_m3?: number
        }
        Relationships: [
          {
            foreignKeyName: "cotizaciones_agente_id_fkey"
            columns: ["agente_id"]
            isOneToOne: false
            referencedRelation: "costeo_agentes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cotizaciones_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cotizaciones_duplicada_de_id_fkey"
            columns: ["duplicada_de_id"]
            isOneToOne: false
            referencedRelation: "cotizaciones"
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
            foreignKeyName: "cotizaciones_lcl_consolidador_id_fkey"
            columns: ["lcl_consolidador_id"]
            isOneToOne: false
            referencedRelation: "proveedores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cotizaciones_naviera_id_fkey"
            columns: ["naviera_id"]
            isOneToOne: false
            referencedRelation: "navieras"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cotizaciones_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cotizaciones_tarifa_id_fkey"
            columns: ["tarifa_id"]
            isOneToOne: false
            referencedRelation: "costeo_tarifas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cotizaciones_tarifa_id_fkey"
            columns: ["tarifa_id"]
            isOneToOne: false
            referencedRelation: "costeo_tarifas_vigentes_v"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_actividades: {
        Row: {
          asunto: string
          contacto_efectivo: boolean
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
          reunion_calificada: boolean
          tipo: Database["public"]["Enums"]["crm_actividad_tipo"]
          updated_at: string
        }
        Insert: {
          asunto: string
          contacto_efectivo?: boolean
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
          reunion_calificada?: boolean
          tipo: Database["public"]["Enums"]["crm_actividad_tipo"]
          updated_at?: string
        }
        Update: {
          asunto?: string
          contacto_efectivo?: boolean
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
          reunion_calificada?: boolean
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
      crm_etapa_criterios: {
        Row: {
          activo: boolean
          created_at: string
          deleted_at: string | null
          deleted_by: string | null
          etapa_id: string
          id: string
          nombre: string
          obligatorio: boolean
          orden: number
          organization_id: string
          updated_at: string
        }
        Insert: {
          activo?: boolean
          created_at?: string
          deleted_at?: string | null
          deleted_by?: string | null
          etapa_id: string
          id?: string
          nombre: string
          obligatorio?: boolean
          orden?: number
          organization_id?: string
          updated_at?: string
        }
        Update: {
          activo?: boolean
          created_at?: string
          deleted_at?: string | null
          deleted_by?: string | null
          etapa_id?: string
          id?: string
          nombre?: string
          obligatorio?: boolean
          orden?: number
          organization_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "crm_etapa_criterios_etapa_id_fkey"
            columns: ["etapa_id"]
            isOneToOne: false
            referencedRelation: "crm_etapas_pipeline"
            referencedColumns: ["id"]
          },
        ]
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
          sla_dias: number | null
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
          sla_dias?: number | null
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
          sla_dias?: number | null
          tipo?: Database["public"]["Enums"]["crm_etapa_tipo"]
          updated_at?: string
        }
        Relationships: []
      }
      crm_historial_etapas: {
        Row: {
          created_at: string
          dias_en_etapa: number | null
          etapa_destino_id: string
          etapa_origen_id: string | null
          id: string
          oportunidad_id: string
          organization_id: string
          usuario_email: string | null
          usuario_id: string | null
        }
        Insert: {
          created_at?: string
          dias_en_etapa?: number | null
          etapa_destino_id: string
          etapa_origen_id?: string | null
          id?: string
          oportunidad_id: string
          organization_id: string
          usuario_email?: string | null
          usuario_id?: string | null
        }
        Update: {
          created_at?: string
          dias_en_etapa?: number | null
          etapa_destino_id?: string
          etapa_origen_id?: string | null
          id?: string
          oportunidad_id?: string
          organization_id?: string
          usuario_email?: string | null
          usuario_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "crm_historial_etapas_etapa_destino_id_fkey"
            columns: ["etapa_destino_id"]
            isOneToOne: false
            referencedRelation: "crm_etapas_pipeline"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_historial_etapas_etapa_origen_id_fkey"
            columns: ["etapa_origen_id"]
            isOneToOne: false
            referencedRelation: "crm_etapas_pipeline"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_historial_etapas_oportunidad_id_fkey"
            columns: ["oportunidad_id"]
            isOneToOne: false
            referencedRelation: "crm_oportunidades"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_leads: {
        Row: {
          aduana_puerto: string | null
          anios_establecida: number | null
          cargo_contacto: string | null
          ciudad: string
          cliente_convertido_id: string | null
          consecuencia: string | null
          contacto: string
          cp: string
          created_at: string
          created_by: string | null
          deleted_at: string | null
          deleted_by: string | null
          destino: string | null
          direccion: string
          dolor_explicito: string | null
          email: string
          empresa: string
          entidad_federativa: string
          estado: Database["public"]["Enums"]["crm_lead_estado"]
          estatus_icp: string | null
          fecha_nutricion: string | null
          frecuencia: string | null
          fuente: Database["public"]["Enums"]["crm_lead_fuente"]
          id: string
          incoterm: string | null
          interes_modo: string
          mercancia: string | null
          motivo_nutricion: string | null
          notas: string
          oportunidad_convertida_id: string | null
          organization_id: string
          origen: string | null
          pais: string
          proveedor_actual: string | null
          rfc: string
          rutas: string | null
          score: number
          sector: string | null
          sitio_web: string | null
          telefono: string
          updated_at: string
          vendedor_email: string
          vendedor_id: string | null
          volumen: string | null
        }
        Insert: {
          aduana_puerto?: string | null
          anios_establecida?: number | null
          cargo_contacto?: string | null
          ciudad?: string
          cliente_convertido_id?: string | null
          consecuencia?: string | null
          contacto?: string
          cp?: string
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          destino?: string | null
          direccion?: string
          dolor_explicito?: string | null
          email?: string
          empresa: string
          entidad_federativa?: string
          estado?: Database["public"]["Enums"]["crm_lead_estado"]
          estatus_icp?: string | null
          fecha_nutricion?: string | null
          frecuencia?: string | null
          fuente?: Database["public"]["Enums"]["crm_lead_fuente"]
          id?: string
          incoterm?: string | null
          interes_modo?: string
          mercancia?: string | null
          motivo_nutricion?: string | null
          notas?: string
          oportunidad_convertida_id?: string | null
          organization_id?: string
          origen?: string | null
          pais?: string
          proveedor_actual?: string | null
          rfc?: string
          rutas?: string | null
          score?: number
          sector?: string | null
          sitio_web?: string | null
          telefono?: string
          updated_at?: string
          vendedor_email?: string
          vendedor_id?: string | null
          volumen?: string | null
        }
        Update: {
          aduana_puerto?: string | null
          anios_establecida?: number | null
          cargo_contacto?: string | null
          ciudad?: string
          cliente_convertido_id?: string | null
          consecuencia?: string | null
          contacto?: string
          cp?: string
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          destino?: string | null
          direccion?: string
          dolor_explicito?: string | null
          email?: string
          empresa?: string
          entidad_federativa?: string
          estado?: Database["public"]["Enums"]["crm_lead_estado"]
          estatus_icp?: string | null
          fecha_nutricion?: string | null
          frecuencia?: string | null
          fuente?: Database["public"]["Enums"]["crm_lead_fuente"]
          id?: string
          incoterm?: string | null
          interes_modo?: string
          mercancia?: string | null
          motivo_nutricion?: string | null
          notas?: string
          oportunidad_convertida_id?: string | null
          organization_id?: string
          origen?: string | null
          pais?: string
          proveedor_actual?: string | null
          rfc?: string
          rutas?: string | null
          score?: number
          sector?: string | null
          sitio_web?: string | null
          telefono?: string
          updated_at?: string
          vendedor_email?: string
          vendedor_id?: string | null
          volumen?: string | null
        }
        Relationships: []
      }
      crm_metas_actividad: {
        Row: {
          contactadas: number
          cotizaciones: number
          created_at: string
          icp_validados: number
          id: string
          organization_id: string
          periodo: string
          reuniones: number
          updated_at: string
        }
        Insert: {
          contactadas?: number
          cotizaciones?: number
          created_at?: string
          icp_validados?: number
          id?: string
          organization_id: string
          periodo: string
          reuniones?: number
          updated_at?: string
        }
        Update: {
          contactadas?: number
          cotizaciones?: number
          created_at?: string
          icp_validados?: number
          id?: string
          organization_id?: string
          periodo?: string
          reuniones?: number
          updated_at?: string
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
          updated_at: string | null
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
          updated_at?: string | null
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
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      crm_oportunidad_criterios: {
        Row: {
          created_at: string
          criterio_id: string
          cumplido_at: string
          cumplido_por: string | null
          id: string
          oportunidad_id: string
          organization_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          criterio_id: string
          cumplido_at?: string
          cumplido_por?: string | null
          id?: string
          oportunidad_id: string
          organization_id?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          criterio_id?: string
          cumplido_at?: string
          cumplido_por?: string | null
          id?: string
          oportunidad_id?: string
          organization_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "crm_oportunidad_criterios_criterio_id_fkey"
            columns: ["criterio_id"]
            isOneToOne: false
            referencedRelation: "crm_etapa_criterios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_oportunidad_criterios_oportunidad_id_fkey"
            columns: ["oportunidad_id"]
            isOneToOne: false
            referencedRelation: "crm_oportunidades"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_oportunidades: {
        Row: {
          aduana_puerto: string | null
          cliente_id: string | null
          cliente_nombre: string
          compromiso_nota: string | null
          cotizacion_ganadora_id: string | null
          created_at: string
          created_by: string | null
          deleted_at: string | null
          deleted_by: string | null
          destino: string
          dolor_explicito: string | null
          embarque_ganador_id: string | null
          etapa_desde_at: string | null
          etapa_id: string
          fecha_cierre_real: string | null
          fecha_estimada_cierre: string | null
          fecha_meta_cierre: string | null
          frecuencia: string | null
          id: string
          incoterm: string | null
          lead_id: string | null
          margen_autorizado_at: string | null
          margen_autorizado_por: string | null
          margen_pct: number | null
          mercancia: string | null
          modo: string
          moneda: string
          monto_estimado: number
          monto_meta: number | null
          motivo_perdida_id: string | null
          nombre: string
          notas: string
          organization_id: string
          origen: string
          probabilidad: number
          proveedor_actual: string | null
          riesgos_objeciones: string | null
          rutas: string | null
          sector: string | null
          tipo_carga: string
          ultimo_movimiento_at: string | null
          updated_at: string
          valor_real: number | null
          vendedor_email: string
          vendedor_id: string | null
          volumen: string | null
        }
        Insert: {
          aduana_puerto?: string | null
          cliente_id?: string | null
          cliente_nombre?: string
          compromiso_nota?: string | null
          cotizacion_ganadora_id?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          destino?: string
          dolor_explicito?: string | null
          embarque_ganador_id?: string | null
          etapa_desde_at?: string | null
          etapa_id: string
          fecha_cierre_real?: string | null
          fecha_estimada_cierre?: string | null
          fecha_meta_cierre?: string | null
          frecuencia?: string | null
          id?: string
          incoterm?: string | null
          lead_id?: string | null
          margen_autorizado_at?: string | null
          margen_autorizado_por?: string | null
          margen_pct?: number | null
          mercancia?: string | null
          modo?: string
          moneda?: string
          monto_estimado?: number
          monto_meta?: number | null
          motivo_perdida_id?: string | null
          nombre: string
          notas?: string
          organization_id?: string
          origen?: string
          probabilidad?: number
          proveedor_actual?: string | null
          riesgos_objeciones?: string | null
          rutas?: string | null
          sector?: string | null
          tipo_carga?: string
          ultimo_movimiento_at?: string | null
          updated_at?: string
          valor_real?: number | null
          vendedor_email?: string
          vendedor_id?: string | null
          volumen?: string | null
        }
        Update: {
          aduana_puerto?: string | null
          cliente_id?: string | null
          cliente_nombre?: string
          compromiso_nota?: string | null
          cotizacion_ganadora_id?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          destino?: string
          dolor_explicito?: string | null
          embarque_ganador_id?: string | null
          etapa_desde_at?: string | null
          etapa_id?: string
          fecha_cierre_real?: string | null
          fecha_estimada_cierre?: string | null
          fecha_meta_cierre?: string | null
          frecuencia?: string | null
          id?: string
          incoterm?: string | null
          lead_id?: string | null
          margen_autorizado_at?: string | null
          margen_autorizado_por?: string | null
          margen_pct?: number | null
          mercancia?: string | null
          modo?: string
          moneda?: string
          monto_estimado?: number
          monto_meta?: number | null
          motivo_perdida_id?: string | null
          nombre?: string
          notas?: string
          organization_id?: string
          origen?: string
          probabilidad?: number
          proveedor_actual?: string | null
          riesgos_objeciones?: string | null
          rutas?: string | null
          sector?: string | null
          tipo_carga?: string
          ultimo_movimiento_at?: string | null
          updated_at?: string
          valor_real?: number | null
          vendedor_email?: string
          vendedor_id?: string | null
          volumen?: string | null
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
      crm_presupuesto_mensual: {
        Row: {
          anio: number
          created_at: string
          id: string
          mes: number
          moneda: Database["public"]["Enums"]["moneda"]
          monto: number
          organization_id: string
          updated_at: string
        }
        Insert: {
          anio: number
          created_at?: string
          id?: string
          mes: number
          moneda?: Database["public"]["Enums"]["moneda"]
          monto?: number
          organization_id: string
          updated_at?: string
        }
        Update: {
          anio?: number
          created_at?: string
          id?: string
          mes?: number
          moneda?: Database["public"]["Enums"]["moneda"]
          monto?: number
          organization_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      cron_locks: {
        Row: {
          key: string
          locked_at: string
          owner: string | null
        }
        Insert: {
          key: string
          locked_at?: string
          owner?: string | null
        }
        Update: {
          key?: string
          locked_at?: string
          owner?: string | null
        }
        Relationships: []
      }
      cuentas_bancarias: {
        Row: {
          activa: boolean
          alias: string
          banco: string
          clabe: string
          created_at: string
          deleted_at: string | null
          deleted_by: string | null
          fecha_saldo_inicial: string
          id: string
          moneda: Database["public"]["Enums"]["moneda"]
          notas: string
          numero_cuenta: string
          organization_id: string
          saldo_inicial: number
          updated_at: string
        }
        Insert: {
          activa?: boolean
          alias: string
          banco?: string
          clabe?: string
          created_at?: string
          deleted_at?: string | null
          deleted_by?: string | null
          fecha_saldo_inicial?: string
          id?: string
          moneda?: Database["public"]["Enums"]["moneda"]
          notas?: string
          numero_cuenta?: string
          organization_id?: string
          saldo_inicial?: number
          updated_at?: string
        }
        Update: {
          activa?: boolean
          alias?: string
          banco?: string
          clabe?: string
          created_at?: string
          deleted_at?: string | null
          deleted_by?: string | null
          fecha_saldo_inicial?: string
          id?: string
          moneda?: Database["public"]["Enums"]["moneda"]
          notas?: string
          numero_cuenta?: string
          organization_id?: string
          saldo_inicial?: number
          updated_at?: string
        }
        Relationships: []
      }
      demo_leads: {
        Row: {
          created_at: string
          email: string
          empresa: string
          id: string
          landing_path: string | null
          nombre: string
          referrer: string | null
          telefono_e164: string
          user_agent: string | null
          utm_campaign: string | null
          utm_content: string | null
          utm_medium: string | null
          utm_source: string | null
          utm_term: string | null
        }
        Insert: {
          created_at?: string
          email: string
          empresa: string
          id?: string
          landing_path?: string | null
          nombre: string
          referrer?: string | null
          telefono_e164: string
          user_agent?: string | null
          utm_campaign?: string | null
          utm_content?: string | null
          utm_medium?: string | null
          utm_source?: string | null
          utm_term?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          empresa?: string
          id?: string
          landing_path?: string | null
          nombre?: string
          referrer?: string | null
          telefono_e164?: string
          user_agent?: string | null
          utm_campaign?: string | null
          utm_content?: string | null
          utm_medium?: string | null
          utm_source?: string | null
          utm_term?: string | null
        }
        Relationships: []
      }
      demo_seed_state: {
        Row: {
          id: boolean
          last_seeded_at: string
        }
        Insert: {
          id?: boolean
          last_seeded_at?: string
        }
        Update: {
          id?: boolean
          last_seeded_at?: string
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
          updated_at: string | null
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
          updated_at?: string | null
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
          updated_at?: string | null
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
      email_send_log: {
        Row: {
          created_at: string
          error_message: string | null
          id: string
          intentos: number
          message_id: string | null
          metadata: Json | null
          recipient_email: string
          status: string
          template_name: string
        }
        Insert: {
          created_at?: string
          error_message?: string | null
          id?: string
          intentos?: number
          message_id?: string | null
          metadata?: Json | null
          recipient_email: string
          status: string
          template_name: string
        }
        Update: {
          created_at?: string
          error_message?: string | null
          id?: string
          intentos?: number
          message_id?: string | null
          metadata?: Json | null
          recipient_email?: string
          status?: string
          template_name?: string
        }
        Relationships: []
      }
      email_send_state: {
        Row: {
          auth_email_ttl_minutes: number
          batch_size: number
          id: number
          retry_after_until: string | null
          send_delay_ms: number
          transactional_email_ttl_minutes: number
          updated_at: string
        }
        Insert: {
          auth_email_ttl_minutes?: number
          batch_size?: number
          id?: number
          retry_after_until?: string | null
          send_delay_ms?: number
          transactional_email_ttl_minutes?: number
          updated_at?: string
        }
        Update: {
          auth_email_ttl_minutes?: number
          batch_size?: number
          id?: number
          retry_after_until?: string | null
          send_delay_ms?: number
          transactional_email_ttl_minutes?: number
          updated_at?: string
        }
        Relationships: []
      }
      email_unsubscribe_tokens: {
        Row: {
          created_at: string
          email: string
          id: string
          token: string
          used_at: string | null
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          token: string
          used_at?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          token?: string
          used_at?: string | null
        }
        Relationships: []
      }
      embarque_contenedores: {
        Row: {
          bl_house: string | null
          created_at: string
          deleted_at: string | null
          deleted_by: string | null
          dias_libres_override: number | null
          embarque_id: string
          fecha_descarga: string | null
          fecha_devolucion: string | null
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
          bl_house?: string | null
          created_at?: string
          deleted_at?: string | null
          deleted_by?: string | null
          dias_libres_override?: number | null
          embarque_id: string
          fecha_descarga?: string | null
          fecha_devolucion?: string | null
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
          bl_house?: string | null
          created_at?: string
          deleted_at?: string | null
          deleted_by?: string | null
          dias_libres_override?: number | null
          embarque_id?: string
          fecha_descarga?: string | null
          fecha_devolucion?: string | null
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
      embarque_facturas_entrantes: {
        Row: {
          archivo_hash: string
          archivo_path: string
          capturado_por: string | null
          created_at: string
          deleted_at: string | null
          embarque_id: string
          estado: string
          fecha_emision: string | null
          folio_detectado: string | null
          folio_serie: string | null
          ia_estado: string
          ia_payload: Json | null
          id: string
          metadatos_verificados: boolean
          moneda_declarada: string | null
          moneda_detectada: string | null
          monto_declarado: number | null
          nombre_archivo: string
          nota: string | null
          organization_id: string
          proveedor_factura_id: string | null
          proveedor_id: string | null
          rechazo_motivo: string | null
          rfc_emisor: string | null
          sin_costo_capturado: boolean
          subido_por: string | null
          subtotal_detectado: number | null
          total_detectado: number | null
          updated_at: string
          uuid_fiscal: string | null
          xml_hash: string | null
          xml_nombre: string | null
          xml_path: string | null
        }
        Insert: {
          archivo_hash: string
          archivo_path: string
          capturado_por?: string | null
          created_at?: string
          deleted_at?: string | null
          embarque_id: string
          estado?: string
          fecha_emision?: string | null
          folio_detectado?: string | null
          folio_serie?: string | null
          ia_estado?: string
          ia_payload?: Json | null
          id?: string
          metadatos_verificados?: boolean
          moneda_declarada?: string | null
          moneda_detectada?: string | null
          monto_declarado?: number | null
          nombre_archivo: string
          nota?: string | null
          organization_id: string
          proveedor_factura_id?: string | null
          proveedor_id?: string | null
          rechazo_motivo?: string | null
          rfc_emisor?: string | null
          sin_costo_capturado?: boolean
          subido_por?: string | null
          subtotal_detectado?: number | null
          total_detectado?: number | null
          updated_at?: string
          uuid_fiscal?: string | null
          xml_hash?: string | null
          xml_nombre?: string | null
          xml_path?: string | null
        }
        Update: {
          archivo_hash?: string
          archivo_path?: string
          capturado_por?: string | null
          created_at?: string
          deleted_at?: string | null
          embarque_id?: string
          estado?: string
          fecha_emision?: string | null
          folio_detectado?: string | null
          folio_serie?: string | null
          ia_estado?: string
          ia_payload?: Json | null
          id?: string
          metadatos_verificados?: boolean
          moneda_declarada?: string | null
          moneda_detectada?: string | null
          monto_declarado?: number | null
          nombre_archivo?: string
          nota?: string | null
          organization_id?: string
          proveedor_factura_id?: string | null
          proveedor_id?: string | null
          rechazo_motivo?: string | null
          rfc_emisor?: string | null
          sin_costo_capturado?: boolean
          subido_por?: string | null
          subtotal_detectado?: number | null
          total_detectado?: number | null
          updated_at?: string
          uuid_fiscal?: string | null
          xml_hash?: string | null
          xml_nombre?: string | null
          xml_path?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "embarque_facturas_entrantes_embarque_id_fkey"
            columns: ["embarque_id"]
            isOneToOne: false
            referencedRelation: "embarques"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "embarque_facturas_entrantes_proveedor_factura_id_fkey"
            columns: ["proveedor_factura_id"]
            isOneToOne: false
            referencedRelation: "cxp_alertas_vencimiento"
            referencedColumns: ["proveedor_factura_id"]
          },
          {
            foreignKeyName: "embarque_facturas_entrantes_proveedor_factura_id_fkey"
            columns: ["proveedor_factura_id"]
            isOneToOne: false
            referencedRelation: "proveedor_facturas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "embarque_facturas_entrantes_proveedor_factura_id_fkey"
            columns: ["proveedor_factura_id"]
            isOneToOne: false
            referencedRelation: "v_proveedor_facturas_saldo"
            referencedColumns: ["proveedor_factura_id"]
          },
          {
            foreignKeyName: "embarque_facturas_entrantes_proveedor_id_fkey"
            columns: ["proveedor_id"]
            isOneToOne: false
            referencedRelation: "proveedores"
            referencedColumns: ["id"]
          },
        ]
      }
      embarque_facturas_entrantes_conceptos: {
        Row: {
          concepto_costo_id: string
          created_at: string
          entrante_id: string
          id: string
          monto_sugerido: number | null
          organization_id: string
          updated_at: string
        }
        Insert: {
          concepto_costo_id: string
          created_at?: string
          entrante_id: string
          id?: string
          monto_sugerido?: number | null
          organization_id: string
          updated_at?: string
        }
        Update: {
          concepto_costo_id?: string
          created_at?: string
          entrante_id?: string
          id?: string
          monto_sugerido?: number | null
          organization_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "embarque_facturas_entrantes_conceptos_concepto_costo_id_fkey"
            columns: ["concepto_costo_id"]
            isOneToOne: false
            referencedRelation: "conceptos_costo"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "embarque_facturas_entrantes_conceptos_entrante_id_fkey"
            columns: ["entrante_id"]
            isOneToOne: false
            referencedRelation: "embarque_facturas_entrantes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "embarque_facturas_entrantes_conceptos_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      embarque_garantias_contenedor: {
        Row: {
          created_at: string
          deleted_at: string | null
          deleted_by: string | null
          embarque_contenedor_id: string
          embarque_id: string
          estado: string
          fecha_deposito: string | null
          fecha_liberacion: string | null
          fecha_limite_devolucion: string | null
          id: string
          monto_deposito_usd: number
          naviera_id: string | null
          notas: string | null
          organization_id: string
          proveedor_factura_id: string | null
          referencia_deposito: string | null
          tiene_carta_garantia: boolean
          updated_at: string
        }
        Insert: {
          created_at?: string
          deleted_at?: string | null
          deleted_by?: string | null
          embarque_contenedor_id: string
          embarque_id: string
          estado?: string
          fecha_deposito?: string | null
          fecha_liberacion?: string | null
          fecha_limite_devolucion?: string | null
          id?: string
          monto_deposito_usd?: number
          naviera_id?: string | null
          notas?: string | null
          organization_id?: string
          proveedor_factura_id?: string | null
          referencia_deposito?: string | null
          tiene_carta_garantia?: boolean
          updated_at?: string
        }
        Update: {
          created_at?: string
          deleted_at?: string | null
          deleted_by?: string | null
          embarque_contenedor_id?: string
          embarque_id?: string
          estado?: string
          fecha_deposito?: string | null
          fecha_liberacion?: string | null
          fecha_limite_devolucion?: string | null
          id?: string
          monto_deposito_usd?: number
          naviera_id?: string | null
          notas?: string | null
          organization_id?: string
          proveedor_factura_id?: string | null
          referencia_deposito?: string | null
          tiene_carta_garantia?: boolean
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "embarque_garantias_contenedor_embarque_contenedor_id_fkey"
            columns: ["embarque_contenedor_id"]
            isOneToOne: true
            referencedRelation: "embarque_contenedores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "embarque_garantias_contenedor_embarque_id_fkey"
            columns: ["embarque_id"]
            isOneToOne: false
            referencedRelation: "embarques"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "embarque_garantias_contenedor_naviera_id_fkey"
            columns: ["naviera_id"]
            isOneToOne: false
            referencedRelation: "navieras"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "embarque_garantias_contenedor_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "embarque_garantias_contenedor_proveedor_factura_id_fkey"
            columns: ["proveedor_factura_id"]
            isOneToOne: false
            referencedRelation: "cxp_alertas_vencimiento"
            referencedColumns: ["proveedor_factura_id"]
          },
          {
            foreignKeyName: "embarque_garantias_contenedor_proveedor_factura_id_fkey"
            columns: ["proveedor_factura_id"]
            isOneToOne: false
            referencedRelation: "proveedor_facturas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "embarque_garantias_contenedor_proveedor_factura_id_fkey"
            columns: ["proveedor_factura_id"]
            isOneToOne: false
            referencedRelation: "v_proveedor_facturas_saldo"
            referencedColumns: ["proveedor_factura_id"]
          },
        ]
      }
      embarque_garantias_historial: {
        Row: {
          changed_at: string
          changed_by: string | null
          estado_anterior: string | null
          estado_nuevo: string
          garantia_id: string
          id: string
          monto_deposito_usd: number | null
          notas: string | null
          organization_id: string
          referencia_deposito: string | null
        }
        Insert: {
          changed_at?: string
          changed_by?: string | null
          estado_anterior?: string | null
          estado_nuevo: string
          garantia_id: string
          id?: string
          monto_deposito_usd?: number | null
          notas?: string | null
          organization_id: string
          referencia_deposito?: string | null
        }
        Update: {
          changed_at?: string
          changed_by?: string | null
          estado_anterior?: string | null
          estado_nuevo?: string
          garantia_id?: string
          id?: string
          monto_deposito_usd?: number | null
          notas?: string | null
          organization_id?: string
          referencia_deposito?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "embarque_garantias_historial_garantia_id_fkey"
            columns: ["garantia_id"]
            isOneToOne: false
            referencedRelation: "embarque_garantias_contenedor"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "embarque_garantias_historial_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
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
          agente_id: string | null
          bl_house: string | null
          bl_master: string | null
          carta_garantia: boolean
          carta_porte: string | null
          cerrado_at: string | null
          cerrado_por: string | null
          cerrado_snapshot: Json | null
          ciudad_destino: string | null
          ciudad_origen: string | null
          cliente_id: string
          cliente_nombre: string
          cobro_cliente_actualizado_at: string | null
          cobro_cliente_status: string
          consignatario: string
          contenedor: string | null
          cotizacion_id: string | null
          created_at: string
          created_by: string | null
          created_by_email: string | null
          deleted_at: string | null
          deleted_by: string | null
          descripcion_mercancia: string
          dias_almacenaje: number
          dias_libres_destino: number
          estado: Database["public"]["Enums"]["estado_embarque"]
          eta: string | null
          eta_original: string | null
          etd: string | null
          etd_original: string | null
          expediente: string | null
          facturado_historico: boolean
          fecha_creacion: string
          fecha_llegada_real: string | null
          hawb: string | null
          id: string
          incoterm: Database["public"]["Enums"]["incoterm"]
          mawb: string | null
          modo: Database["public"]["Enums"]["modo_transporte"]
          msds_archivo: string | null
          naviera: string | null
          naviera_id: string | null
          notas: string | null
          operador: string
          organization_id: string
          peso_kg: number
          piezas: number
          puerto_destino: string | null
          puerto_origen: string | null
          reabierto_at: string | null
          reabierto_motivo: string | null
          reabierto_por: string | null
          seguro: boolean
          shipper: string
          sin_comision: boolean | null
          tarifa_decision: string | null
          tarifa_delta_jsonb: Json | null
          tarifa_id: string | null
          tarifa_id_aplicada: string | null
          tarifa_id_original: string | null
          tarifa_revalidada_en: string | null
          tarifa_revalidada_por: string | null
          tiene_proforma: boolean
          tipo: Database["public"]["Enums"]["tipo_operacion"]
          tipo_cambio_eur: number | null
          tipo_cambio_usd: number | null
          tipo_carga: string
          tipo_contenedor: string | null
          tipo_servicio:
            | Database["public"]["Enums"]["tipo_servicio_maritimo"]
            | null
          transportista: string | null
          updated_at: string
          valor_seguro_usd: number | null
          vendedora_id: string | null
          volumen_m3: number
        }
        Insert: {
          aerolinea?: string | null
          aeropuerto_destino?: string | null
          aeropuerto_origen?: string | null
          agente?: string | null
          agente_id?: string | null
          bl_house?: string | null
          bl_master?: string | null
          carta_garantia?: boolean
          carta_porte?: string | null
          cerrado_at?: string | null
          cerrado_por?: string | null
          cerrado_snapshot?: Json | null
          ciudad_destino?: string | null
          ciudad_origen?: string | null
          cliente_id: string
          cliente_nombre?: string
          cobro_cliente_actualizado_at?: string | null
          cobro_cliente_status?: string
          consignatario?: string
          contenedor?: string | null
          cotizacion_id?: string | null
          created_at?: string
          created_by?: string | null
          created_by_email?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          descripcion_mercancia?: string
          dias_almacenaje?: number
          dias_libres_destino?: number
          estado?: Database["public"]["Enums"]["estado_embarque"]
          eta?: string | null
          eta_original?: string | null
          etd?: string | null
          etd_original?: string | null
          expediente?: string | null
          facturado_historico?: boolean
          fecha_creacion?: string
          fecha_llegada_real?: string | null
          hawb?: string | null
          id?: string
          incoterm?: Database["public"]["Enums"]["incoterm"]
          mawb?: string | null
          modo: Database["public"]["Enums"]["modo_transporte"]
          msds_archivo?: string | null
          naviera?: string | null
          naviera_id?: string | null
          notas?: string | null
          operador?: string
          organization_id?: string
          peso_kg?: number
          piezas?: number
          puerto_destino?: string | null
          puerto_origen?: string | null
          reabierto_at?: string | null
          reabierto_motivo?: string | null
          reabierto_por?: string | null
          seguro?: boolean
          shipper?: string
          sin_comision?: boolean | null
          tarifa_decision?: string | null
          tarifa_delta_jsonb?: Json | null
          tarifa_id?: string | null
          tarifa_id_aplicada?: string | null
          tarifa_id_original?: string | null
          tarifa_revalidada_en?: string | null
          tarifa_revalidada_por?: string | null
          tiene_proforma?: boolean
          tipo: Database["public"]["Enums"]["tipo_operacion"]
          tipo_cambio_eur?: number | null
          tipo_cambio_usd?: number | null
          tipo_carga?: string
          tipo_contenedor?: string | null
          tipo_servicio?:
            | Database["public"]["Enums"]["tipo_servicio_maritimo"]
            | null
          transportista?: string | null
          updated_at?: string
          valor_seguro_usd?: number | null
          vendedora_id?: string | null
          volumen_m3?: number
        }
        Update: {
          aerolinea?: string | null
          aeropuerto_destino?: string | null
          aeropuerto_origen?: string | null
          agente?: string | null
          agente_id?: string | null
          bl_house?: string | null
          bl_master?: string | null
          carta_garantia?: boolean
          carta_porte?: string | null
          cerrado_at?: string | null
          cerrado_por?: string | null
          cerrado_snapshot?: Json | null
          ciudad_destino?: string | null
          ciudad_origen?: string | null
          cliente_id?: string
          cliente_nombre?: string
          cobro_cliente_actualizado_at?: string | null
          cobro_cliente_status?: string
          consignatario?: string
          contenedor?: string | null
          cotizacion_id?: string | null
          created_at?: string
          created_by?: string | null
          created_by_email?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          descripcion_mercancia?: string
          dias_almacenaje?: number
          dias_libres_destino?: number
          estado?: Database["public"]["Enums"]["estado_embarque"]
          eta?: string | null
          eta_original?: string | null
          etd?: string | null
          etd_original?: string | null
          expediente?: string | null
          facturado_historico?: boolean
          fecha_creacion?: string
          fecha_llegada_real?: string | null
          hawb?: string | null
          id?: string
          incoterm?: Database["public"]["Enums"]["incoterm"]
          mawb?: string | null
          modo?: Database["public"]["Enums"]["modo_transporte"]
          msds_archivo?: string | null
          naviera?: string | null
          naviera_id?: string | null
          notas?: string | null
          operador?: string
          organization_id?: string
          peso_kg?: number
          piezas?: number
          puerto_destino?: string | null
          puerto_origen?: string | null
          reabierto_at?: string | null
          reabierto_motivo?: string | null
          reabierto_por?: string | null
          seguro?: boolean
          shipper?: string
          sin_comision?: boolean | null
          tarifa_decision?: string | null
          tarifa_delta_jsonb?: Json | null
          tarifa_id?: string | null
          tarifa_id_aplicada?: string | null
          tarifa_id_original?: string | null
          tarifa_revalidada_en?: string | null
          tarifa_revalidada_por?: string | null
          tiene_proforma?: boolean
          tipo?: Database["public"]["Enums"]["tipo_operacion"]
          tipo_cambio_eur?: number | null
          tipo_cambio_usd?: number | null
          tipo_carga?: string
          tipo_contenedor?: string | null
          tipo_servicio?:
            | Database["public"]["Enums"]["tipo_servicio_maritimo"]
            | null
          transportista?: string | null
          updated_at?: string
          valor_seguro_usd?: number | null
          vendedora_id?: string | null
          volumen_m3?: number
        }
        Relationships: [
          {
            foreignKeyName: "embarques_agente_id_fkey"
            columns: ["agente_id"]
            isOneToOne: false
            referencedRelation: "costeo_agentes"
            referencedColumns: ["id"]
          },
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
            foreignKeyName: "embarques_naviera_id_fkey"
            columns: ["naviera_id"]
            isOneToOne: false
            referencedRelation: "navieras"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "embarques_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "embarques_tarifa_id_aplicada_fkey"
            columns: ["tarifa_id_aplicada"]
            isOneToOne: false
            referencedRelation: "costeo_tarifas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "embarques_tarifa_id_aplicada_fkey"
            columns: ["tarifa_id_aplicada"]
            isOneToOne: false
            referencedRelation: "costeo_tarifas_vigentes_v"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "embarques_tarifa_id_fkey"
            columns: ["tarifa_id"]
            isOneToOne: false
            referencedRelation: "costeo_tarifas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "embarques_tarifa_id_fkey"
            columns: ["tarifa_id"]
            isOneToOne: false
            referencedRelation: "costeo_tarifas_vigentes_v"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "embarques_tarifa_id_original_fkey"
            columns: ["tarifa_id_original"]
            isOneToOne: false
            referencedRelation: "costeo_tarifas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "embarques_tarifa_id_original_fkey"
            columns: ["tarifa_id_original"]
            isOneToOne: false
            referencedRelation: "costeo_tarifas_vigentes_v"
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
          updated_at: string | null
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
          updated_at?: string | null
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
          updated_at?: string | null
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
      factura_embarques: {
        Row: {
          activa: boolean
          created_at: string
          embarque_id: string
          factura_id: string
          organization_id: string
        }
        Insert: {
          activa?: boolean
          created_at?: string
          embarque_id: string
          factura_id: string
          organization_id: string
        }
        Update: {
          activa?: boolean
          created_at?: string
          embarque_id?: string
          factura_id?: string
          organization_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "factura_embarques_embarque_id_fkey"
            columns: ["embarque_id"]
            isOneToOne: false
            referencedRelation: "embarques"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "factura_embarques_factura_id_fkey"
            columns: ["factura_id"]
            isOneToOne: false
            referencedRelation: "facturas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "factura_embarques_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      factura_envios: {
        Row: {
          asunto: string | null
          cc: Json
          created_at: string
          destinatarios: Json
          enviado_por: string | null
          error: string | null
          estado: string
          factura_id: string
          id: string
          mensaje: string | null
          organization_id: string
          pdf_link_publico: string | null
          pdf_storage_path: string | null
          xml_link_publico: string | null
          xml_storage_path: string | null
        }
        Insert: {
          asunto?: string | null
          cc?: Json
          created_at?: string
          destinatarios?: Json
          enviado_por?: string | null
          error?: string | null
          estado?: string
          factura_id: string
          id?: string
          mensaje?: string | null
          organization_id: string
          pdf_link_publico?: string | null
          pdf_storage_path?: string | null
          xml_link_publico?: string | null
          xml_storage_path?: string | null
        }
        Update: {
          asunto?: string | null
          cc?: Json
          created_at?: string
          destinatarios?: Json
          enviado_por?: string | null
          error?: string | null
          estado?: string
          factura_id?: string
          id?: string
          mensaje?: string | null
          organization_id?: string
          pdf_link_publico?: string | null
          pdf_storage_path?: string | null
          xml_link_publico?: string | null
          xml_storage_path?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "factura_envios_factura_id_fkey"
            columns: ["factura_id"]
            isOneToOne: false
            referencedRelation: "facturas"
            referencedColumns: ["id"]
          },
        ]
      }
      factura_notas_credito: {
        Row: {
          acuse_cancelacion_fecha: string | null
          acuse_cancelacion_status: string | null
          acuse_cancelacion_xml: string | null
          ambiente: Database["public"]["Enums"]["ambiente_facturapi"] | null
          aprobada_at: string | null
          aprobada_por: string | null
          cancelacion_motivo: string | null
          cancelacion_solicitada_en: string | null
          cancelacion_vence_en: string | null
          cancelado_en: string | null
          cancellation_status: string
          conceptos: Json
          created_at: string
          created_by: string | null
          deleted_at: string | null
          deleted_by: string | null
          descripcion: string
          estado: Database["public"]["Enums"]["estado_nota_credito"]
          factura_id: string
          facturapi_claim_at: string | null
          facturapi_id: string | null
          fecha_emision: string
          folio: string
          folio_fiscal: number | null
          forma_pago: string | null
          id: string
          moneda: Database["public"]["Enums"]["moneda"]
          monto: number
          motivo: Database["public"]["Enums"]["motivo_nota_credito"]
          organization_id: string
          pdf_url: string | null
          serie: string | null
          timbrado_en: string | null
          timbrado_por: string | null
          tipo_cambio: number
          updated_at: string
          uso_cfdi: string | null
          uuid_fiscal: string | null
          xml_backup_path: string | null
          xml_url: string | null
        }
        Insert: {
          acuse_cancelacion_fecha?: string | null
          acuse_cancelacion_status?: string | null
          acuse_cancelacion_xml?: string | null
          ambiente?: Database["public"]["Enums"]["ambiente_facturapi"] | null
          aprobada_at?: string | null
          aprobada_por?: string | null
          cancelacion_motivo?: string | null
          cancelacion_solicitada_en?: string | null
          cancelacion_vence_en?: string | null
          cancelado_en?: string | null
          cancellation_status?: string
          conceptos?: Json
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          descripcion?: string
          estado?: Database["public"]["Enums"]["estado_nota_credito"]
          factura_id: string
          facturapi_claim_at?: string | null
          facturapi_id?: string | null
          fecha_emision?: string
          folio: string
          folio_fiscal?: number | null
          forma_pago?: string | null
          id?: string
          moneda?: Database["public"]["Enums"]["moneda"]
          monto: number
          motivo?: Database["public"]["Enums"]["motivo_nota_credito"]
          organization_id?: string
          pdf_url?: string | null
          serie?: string | null
          timbrado_en?: string | null
          timbrado_por?: string | null
          tipo_cambio?: number
          updated_at?: string
          uso_cfdi?: string | null
          uuid_fiscal?: string | null
          xml_backup_path?: string | null
          xml_url?: string | null
        }
        Update: {
          acuse_cancelacion_fecha?: string | null
          acuse_cancelacion_status?: string | null
          acuse_cancelacion_xml?: string | null
          ambiente?: Database["public"]["Enums"]["ambiente_facturapi"] | null
          aprobada_at?: string | null
          aprobada_por?: string | null
          cancelacion_motivo?: string | null
          cancelacion_solicitada_en?: string | null
          cancelacion_vence_en?: string | null
          cancelado_en?: string | null
          cancellation_status?: string
          conceptos?: Json
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          descripcion?: string
          estado?: Database["public"]["Enums"]["estado_nota_credito"]
          factura_id?: string
          facturapi_claim_at?: string | null
          facturapi_id?: string | null
          fecha_emision?: string
          folio?: string
          folio_fiscal?: number | null
          forma_pago?: string | null
          id?: string
          moneda?: Database["public"]["Enums"]["moneda"]
          monto?: number
          motivo?: Database["public"]["Enums"]["motivo_nota_credito"]
          organization_id?: string
          pdf_url?: string | null
          serie?: string | null
          timbrado_en?: string | null
          timbrado_por?: string | null
          tipo_cambio?: number
          updated_at?: string
          uso_cfdi?: string | null
          uuid_fiscal?: string | null
          xml_backup_path?: string | null
          xml_url?: string | null
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
      factura_recordatorios: {
        Row: {
          canal: string
          created_at: string
          enviado_por: string
          factura_id: string
          id: string
          nota: string | null
          organization_id: string
        }
        Insert: {
          canal?: string
          created_at?: string
          enviado_por: string
          factura_id: string
          id?: string
          nota?: string | null
          organization_id: string
        }
        Update: {
          canal?: string
          created_at?: string
          enviado_por?: string
          factura_id?: string
          id?: string
          nota?: string | null
          organization_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "factura_recordatorios_factura_id_fkey"
            columns: ["factura_id"]
            isOneToOne: false
            referencedRelation: "facturas"
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
      facturapi_credenciales: {
        Row: {
          ambiente: string
          api_key_live_last4: string | null
          api_key_live_secret_name: string | null
          api_key_live_vault_id: string | null
          api_key_sandbox_last4: string | null
          api_key_sandbox_secret_name: string | null
          api_key_sandbox_vault_id: string | null
          certificado_cargado: boolean
          certificado_vence_at: string | null
          created_at: string
          datos_fiscales_completos: boolean
          facturapi_org_id: string | null
          last_test_timbre_at: string | null
          organization_id: string
          updated_at: string
          webhook_secret: string | null
        }
        Insert: {
          ambiente?: string
          api_key_live_last4?: string | null
          api_key_live_secret_name?: string | null
          api_key_live_vault_id?: string | null
          api_key_sandbox_last4?: string | null
          api_key_sandbox_secret_name?: string | null
          api_key_sandbox_vault_id?: string | null
          certificado_cargado?: boolean
          certificado_vence_at?: string | null
          created_at?: string
          datos_fiscales_completos?: boolean
          facturapi_org_id?: string | null
          last_test_timbre_at?: string | null
          organization_id: string
          updated_at?: string
          webhook_secret?: string | null
        }
        Update: {
          ambiente?: string
          api_key_live_last4?: string | null
          api_key_live_secret_name?: string | null
          api_key_live_vault_id?: string | null
          api_key_sandbox_last4?: string | null
          api_key_sandbox_secret_name?: string | null
          api_key_sandbox_vault_id?: string | null
          certificado_cargado?: boolean
          certificado_vence_at?: string | null
          created_at?: string
          datos_fiscales_completos?: boolean
          facturapi_org_id?: string | null
          last_test_timbre_at?: string | null
          organization_id?: string
          updated_at?: string
          webhook_secret?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "facturapi_credenciales_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: true
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      facturapi_webhook_eventos: {
        Row: {
          event_id: string
          event_type: string
          id: string
          organization_id: string
          payload: Json | null
          received_at: string
        }
        Insert: {
          event_id: string
          event_type: string
          id?: string
          organization_id: string
          payload?: Json | null
          received_at?: string
        }
        Update: {
          event_id?: string
          event_type?: string
          id?: string
          organization_id?: string
          payload?: Json | null
          received_at?: string
        }
        Relationships: []
      }
      facturas: {
        Row: {
          acuse_cancelacion_fecha: string | null
          acuse_cancelacion_status: string | null
          acuse_cancelacion_xml: string | null
          ambiente: Database["public"]["Enums"]["ambiente_facturapi"] | null
          cancelacion_motivo: string | null
          cancelacion_solicitada_en: string | null
          cancelacion_vence_en: string | null
          cancelado_en: string | null
          cancellation_status: string | null
          cliente_id: string
          cliente_nombre: string
          cotizacion_id: string | null
          created_at: string
          deleted_at: string | null
          deleted_by: string | null
          dias_credito: number | null
          embarque_id: string | null
          enviada_cliente_at: string | null
          estado: Database["public"]["Enums"]["estado_factura"]
          expediente: string
          factura_pdf_url: string | null
          factura_xml_backup_path: string | null
          factura_xml_url: string | null
          facturapi_claim_at: string | null
          facturapi_id: string | null
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
          origen: Database["public"]["Enums"]["origen_factura"]
          proforma_id: string | null
          referencia_bl: string | null
          ret_isr: number
          ret_iva: number
          rfc_cliente: string | null
          serie: string | null
          serie_id: string | null
          snapshot_emision: Json | null
          subtotal: number
          sustituida_por: string | null
          sustituye_a: string | null
          timbrado_en: string | null
          timbrado_por: string | null
          tipo_cambio: number | null
          total: number
          updated_at: string
          uso_cfdi: string | null
          uuid_estatus_sat: string | null
          uuid_fiscal: string | null
          uuid_verificado: boolean
          uuid_verificado_fecha: string | null
        }
        Insert: {
          acuse_cancelacion_fecha?: string | null
          acuse_cancelacion_status?: string | null
          acuse_cancelacion_xml?: string | null
          ambiente?: Database["public"]["Enums"]["ambiente_facturapi"] | null
          cancelacion_motivo?: string | null
          cancelacion_solicitada_en?: string | null
          cancelacion_vence_en?: string | null
          cancelado_en?: string | null
          cancellation_status?: string | null
          cliente_id: string
          cliente_nombre?: string
          cotizacion_id?: string | null
          created_at?: string
          deleted_at?: string | null
          deleted_by?: string | null
          dias_credito?: number | null
          embarque_id?: string | null
          enviada_cliente_at?: string | null
          estado?: Database["public"]["Enums"]["estado_factura"]
          expediente?: string
          factura_pdf_url?: string | null
          factura_xml_backup_path?: string | null
          factura_xml_url?: string | null
          facturapi_claim_at?: string | null
          facturapi_id?: string | null
          fecha_emision?: string
          fecha_vencimiento: string
          folio_fiscal?: number | null
          forma_pago?: string | null
          id?: string
          iva?: number
          metodo_pago?: string | null
          moneda?: Database["public"]["Enums"]["moneda"]
          notas?: string | null
          numero: string
          organization_id?: string
          origen?: Database["public"]["Enums"]["origen_factura"]
          proforma_id?: string | null
          referencia_bl?: string | null
          ret_isr?: number
          ret_iva?: number
          rfc_cliente?: string | null
          serie?: string | null
          serie_id?: string | null
          snapshot_emision?: Json | null
          subtotal?: number
          sustituida_por?: string | null
          sustituye_a?: string | null
          timbrado_en?: string | null
          timbrado_por?: string | null
          tipo_cambio?: number | null
          total?: number
          updated_at?: string
          uso_cfdi?: string | null
          uuid_estatus_sat?: string | null
          uuid_fiscal?: string | null
          uuid_verificado?: boolean
          uuid_verificado_fecha?: string | null
        }
        Update: {
          acuse_cancelacion_fecha?: string | null
          acuse_cancelacion_status?: string | null
          acuse_cancelacion_xml?: string | null
          ambiente?: Database["public"]["Enums"]["ambiente_facturapi"] | null
          cancelacion_motivo?: string | null
          cancelacion_solicitada_en?: string | null
          cancelacion_vence_en?: string | null
          cancelado_en?: string | null
          cancellation_status?: string | null
          cliente_id?: string
          cliente_nombre?: string
          cotizacion_id?: string | null
          created_at?: string
          deleted_at?: string | null
          deleted_by?: string | null
          dias_credito?: number | null
          embarque_id?: string | null
          enviada_cliente_at?: string | null
          estado?: Database["public"]["Enums"]["estado_factura"]
          expediente?: string
          factura_pdf_url?: string | null
          factura_xml_backup_path?: string | null
          factura_xml_url?: string | null
          facturapi_claim_at?: string | null
          facturapi_id?: string | null
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
          origen?: Database["public"]["Enums"]["origen_factura"]
          proforma_id?: string | null
          referencia_bl?: string | null
          ret_isr?: number
          ret_iva?: number
          rfc_cliente?: string | null
          serie?: string | null
          serie_id?: string | null
          snapshot_emision?: Json | null
          subtotal?: number
          sustituida_por?: string | null
          sustituye_a?: string | null
          timbrado_en?: string | null
          timbrado_por?: string | null
          tipo_cambio?: number | null
          total?: number
          updated_at?: string
          uso_cfdi?: string | null
          uuid_estatus_sat?: string | null
          uuid_fiscal?: string | null
          uuid_verificado?: boolean
          uuid_verificado_fecha?: string | null
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
            foreignKeyName: "facturas_cotizacion_id_fkey"
            columns: ["cotizacion_id"]
            isOneToOne: false
            referencedRelation: "cotizaciones"
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
            foreignKeyName: "facturas_proforma_id_fkey"
            columns: ["proforma_id"]
            isOneToOne: false
            referencedRelation: "v_proforma_factura_link"
            referencedColumns: ["proforma_id"]
          },
          {
            foreignKeyName: "facturas_serie_id_fkey"
            columns: ["serie_id"]
            isOneToOne: false
            referencedRelation: "factura_series"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "facturas_sustituida_por_fkey"
            columns: ["sustituida_por"]
            isOneToOne: false
            referencedRelation: "facturas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "facturas_sustituye_a_fkey"
            columns: ["sustituye_a"]
            isOneToOne: false
            referencedRelation: "facturas"
            referencedColumns: ["id"]
          },
        ]
      }
      folio_secuencias: {
        Row: {
          organization_id: string
          tipo: string
          ultimo_numero: number
          updated_at: string
        }
        Insert: {
          organization_id: string
          tipo: string
          ultimo_numero?: number
          updated_at?: string
        }
        Update: {
          organization_id?: string
          tipo?: string
          ultimo_numero?: number
          updated_at?: string
        }
        Relationships: []
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
      liquidaciones_comision: {
        Row: {
          cancelada_at: string | null
          cancelada_por: string | null
          creada_por: string | null
          created_at: string
          deleted_at: string | null
          deleted_by: string | null
          estado: string
          fecha_pago: string | null
          id: string
          metodo_pago: string | null
          motivo_cancelacion: string | null
          notas: string | null
          organization_id: string
          periodo: string
          referencia: string | null
          total_mxn: number
          updated_at: string
          vendedora_id: string
        }
        Insert: {
          cancelada_at?: string | null
          cancelada_por?: string | null
          creada_por?: string | null
          created_at?: string
          deleted_at?: string | null
          deleted_by?: string | null
          estado?: string
          fecha_pago?: string | null
          id?: string
          metodo_pago?: string | null
          motivo_cancelacion?: string | null
          notas?: string | null
          organization_id: string
          periodo: string
          referencia?: string | null
          total_mxn?: number
          updated_at?: string
          vendedora_id: string
        }
        Update: {
          cancelada_at?: string | null
          cancelada_por?: string | null
          creada_por?: string | null
          created_at?: string
          deleted_at?: string | null
          deleted_by?: string | null
          estado?: string
          fecha_pago?: string | null
          id?: string
          metodo_pago?: string | null
          motivo_cancelacion?: string | null
          notas?: string | null
          organization_id?: string
          periodo?: string
          referencia?: string | null
          total_mxn?: number
          updated_at?: string
          vendedora_id?: string
        }
        Relationships: []
      }
      nav_events: {
        Row: {
          created_at: string
          id: string
          item_title: string
          item_url: string
          organization_id: string
          role: string | null
          section_label: string | null
          source: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          item_title: string
          item_url: string
          organization_id?: string
          role?: string | null
          section_label?: string | null
          source: string
          user_id?: string
        }
        Update: {
          created_at?: string
          id?: string
          item_title?: string
          item_url?: string
          organization_id?: string
          role?: string | null
          section_label?: string | null
          source?: string
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
          tracking_url_template: string | null
        }
        Insert: {
          activo?: boolean
          code: string
          created_at?: string
          id?: string
          name: string
          tracking_url_template?: string | null
        }
        Update: {
          activo?: boolean
          code?: string
          created_at?: string
          id?: string
          name?: string
          tracking_url_template?: string | null
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
          updated_at: string | null
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
          updated_at?: string | null
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
          updated_at?: string | null
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
          direccion: string | null
          id: string
          logo_url: string | null
          moneda_preferida: string
          nombre: string
          onboarding_completado: boolean
          plan: string | null
          rfc: string | null
          sat_barrido_fecha: string | null
          updated_at: string | null
        }
        Insert: {
          activo?: boolean | null
          created_at?: string | null
          direccion?: string | null
          id?: string
          logo_url?: string | null
          moneda_preferida?: string
          nombre: string
          onboarding_completado?: boolean
          plan?: string | null
          rfc?: string | null
          sat_barrido_fecha?: string | null
          updated_at?: string | null
        }
        Update: {
          activo?: boolean | null
          created_at?: string | null
          direccion?: string | null
          id?: string
          logo_url?: string | null
          moneda_preferida?: string
          nombre?: string
          onboarding_completado?: boolean
          plan?: string | null
          rfc?: string | null
          sat_barrido_fecha?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      pagos_factura: {
        Row: {
          ambiente: Database["public"]["Enums"]["ambiente_facturapi"] | null
          client_request_id: string | null
          created_at: string
          created_by: string | null
          cuenta_bancaria_id: string | null
          deleted_at: string | null
          deleted_by: string | null
          diferencia_cambiaria_mxn: number
          embarque_id: string | null
          estado_rep: string
          factura_id: string
          facturapi_rep_claim_at: string | null
          facturapi_rep_id: string | null
          fecha_pago: string
          folio_rep: number | null
          forma_pago: string
          id: string
          lote_id: string | null
          moneda: Database["public"]["Enums"]["moneda"]
          monto: number
          monto_aplicado_factura: number
          notas: string
          ordenante_distinto: boolean
          ordenante_nombre: string | null
          ordenante_rfc: string | null
          organization_id: string
          refacturacion_id: string | null
          referencia: string
          rep_cancelado_en: string | null
          rep_cancelado_facturapi_id: string | null
          rep_cancelado_uuid: string | null
          rep_cancellation_status: string
          rep_error: string | null
          rep_motivo_cancel: string | null
          rep_pdf_url: string | null
          rep_xml_backup_path: string | null
          rep_xml_url: string | null
          ret_isr: number
          ret_iva: number
          serie_rep: string | null
          timbrado_rep_en: string | null
          timbrado_rep_por: string | null
          tipo_cambio: number
          updated_at: string
          uuid_rep: string | null
        }
        Insert: {
          ambiente?: Database["public"]["Enums"]["ambiente_facturapi"] | null
          client_request_id?: string | null
          created_at?: string
          created_by?: string | null
          cuenta_bancaria_id?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          diferencia_cambiaria_mxn?: number
          embarque_id?: string | null
          estado_rep?: string
          factura_id: string
          facturapi_rep_claim_at?: string | null
          facturapi_rep_id?: string | null
          fecha_pago: string
          folio_rep?: number | null
          forma_pago?: string
          id?: string
          lote_id?: string | null
          moneda?: Database["public"]["Enums"]["moneda"]
          monto: number
          monto_aplicado_factura: number
          notas?: string
          ordenante_distinto?: boolean
          ordenante_nombre?: string | null
          ordenante_rfc?: string | null
          organization_id?: string
          refacturacion_id?: string | null
          referencia?: string
          rep_cancelado_en?: string | null
          rep_cancelado_facturapi_id?: string | null
          rep_cancelado_uuid?: string | null
          rep_cancellation_status?: string
          rep_error?: string | null
          rep_motivo_cancel?: string | null
          rep_pdf_url?: string | null
          rep_xml_backup_path?: string | null
          rep_xml_url?: string | null
          ret_isr?: number
          ret_iva?: number
          serie_rep?: string | null
          timbrado_rep_en?: string | null
          timbrado_rep_por?: string | null
          tipo_cambio?: number
          updated_at?: string
          uuid_rep?: string | null
        }
        Update: {
          ambiente?: Database["public"]["Enums"]["ambiente_facturapi"] | null
          client_request_id?: string | null
          created_at?: string
          created_by?: string | null
          cuenta_bancaria_id?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          diferencia_cambiaria_mxn?: number
          embarque_id?: string | null
          estado_rep?: string
          factura_id?: string
          facturapi_rep_claim_at?: string | null
          facturapi_rep_id?: string | null
          fecha_pago?: string
          folio_rep?: number | null
          forma_pago?: string
          id?: string
          lote_id?: string | null
          moneda?: Database["public"]["Enums"]["moneda"]
          monto?: number
          monto_aplicado_factura?: number
          notas?: string
          ordenante_distinto?: boolean
          ordenante_nombre?: string | null
          ordenante_rfc?: string | null
          organization_id?: string
          refacturacion_id?: string | null
          referencia?: string
          rep_cancelado_en?: string | null
          rep_cancelado_facturapi_id?: string | null
          rep_cancelado_uuid?: string | null
          rep_cancellation_status?: string
          rep_error?: string | null
          rep_motivo_cancel?: string | null
          rep_pdf_url?: string | null
          rep_xml_backup_path?: string | null
          rep_xml_url?: string | null
          ret_isr?: number
          ret_iva?: number
          serie_rep?: string | null
          timbrado_rep_en?: string | null
          timbrado_rep_por?: string | null
          tipo_cambio?: number
          updated_at?: string
          uuid_rep?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "pagos_factura_cuenta_bancaria_id_fkey"
            columns: ["cuenta_bancaria_id"]
            isOneToOne: false
            referencedRelation: "cuentas_bancarias"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pagos_factura_embarque_id_fkey"
            columns: ["embarque_id"]
            isOneToOne: false
            referencedRelation: "embarques"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pagos_factura_factura_id_fkey"
            columns: ["factura_id"]
            isOneToOne: false
            referencedRelation: "facturas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pagos_factura_lote_id_fkey"
            columns: ["lote_id"]
            isOneToOne: false
            referencedRelation: "pagos_factura_lote"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pagos_factura_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pagos_factura_refacturacion_fk"
            columns: ["refacturacion_id"]
            isOneToOne: false
            referencedRelation: "refacturaciones"
            referencedColumns: ["id"]
          },
        ]
      }
      pagos_factura_lote: {
        Row: {
          cliente_id: string
          created_at: string
          created_by: string | null
          cuenta_bancaria_id: string | null
          deleted_at: string | null
          deleted_by: string | null
          fecha_pago: string
          forma_pago: string
          id: string
          moneda: Database["public"]["Enums"]["moneda"]
          monto_total: number
          notas: string
          organization_id: string
          referencia: string
          tipo_cambio_usd: number | null
          updated_at: string
        }
        Insert: {
          cliente_id: string
          created_at?: string
          created_by?: string | null
          cuenta_bancaria_id?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          fecha_pago?: string
          forma_pago?: string
          id?: string
          moneda: Database["public"]["Enums"]["moneda"]
          monto_total: number
          notas?: string
          organization_id: string
          referencia?: string
          tipo_cambio_usd?: number | null
          updated_at?: string
        }
        Update: {
          cliente_id?: string
          created_at?: string
          created_by?: string | null
          cuenta_bancaria_id?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          fecha_pago?: string
          forma_pago?: string
          id?: string
          moneda?: Database["public"]["Enums"]["moneda"]
          monto_total?: number
          notas?: string
          organization_id?: string
          referencia?: string
          tipo_cambio_usd?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "pagos_factura_lote_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pagos_factura_lote_cuenta_bancaria_id_fkey"
            columns: ["cuenta_bancaria_id"]
            isOneToOne: false
            referencedRelation: "cuentas_bancarias"
            referencedColumns: ["id"]
          },
        ]
      }
      pagos_proveedor: {
        Row: {
          client_request_id: string | null
          created_at: string
          created_by: string | null
          cuenta_bancaria_id: string | null
          deleted_at: string | null
          deleted_by: string | null
          diferencia_cambiaria_mxn: number | null
          es_ajuste: boolean
          es_anticipo_aplicado: boolean
          fecha_pago: string
          id: string
          lote_id: string | null
          metodo_pago: string
          moneda: Database["public"]["Enums"]["moneda"]
          monto: number
          monto_en_moneda_factura: number | null
          motivo_ajuste: string | null
          notas: string
          organization_id: string
          proveedor_factura_id: string
          referencia: string
          tipo_cambio_usd: number | null
          updated_at: string
        }
        Insert: {
          client_request_id?: string | null
          created_at?: string
          created_by?: string | null
          cuenta_bancaria_id?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          diferencia_cambiaria_mxn?: number | null
          es_ajuste?: boolean
          es_anticipo_aplicado?: boolean
          fecha_pago?: string
          id?: string
          lote_id?: string | null
          metodo_pago?: string
          moneda?: Database["public"]["Enums"]["moneda"]
          monto?: number
          monto_en_moneda_factura?: number | null
          motivo_ajuste?: string | null
          notas?: string
          organization_id?: string
          proveedor_factura_id: string
          referencia?: string
          tipo_cambio_usd?: number | null
          updated_at?: string
        }
        Update: {
          client_request_id?: string | null
          created_at?: string
          created_by?: string | null
          cuenta_bancaria_id?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          diferencia_cambiaria_mxn?: number | null
          es_ajuste?: boolean
          es_anticipo_aplicado?: boolean
          fecha_pago?: string
          id?: string
          lote_id?: string | null
          metodo_pago?: string
          moneda?: Database["public"]["Enums"]["moneda"]
          monto?: number
          monto_en_moneda_factura?: number | null
          motivo_ajuste?: string | null
          notas?: string
          organization_id?: string
          proveedor_factura_id?: string
          referencia?: string
          tipo_cambio_usd?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "pagos_proveedor_cuenta_bancaria_id_fkey"
            columns: ["cuenta_bancaria_id"]
            isOneToOne: false
            referencedRelation: "cuentas_bancarias"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pagos_proveedor_lote_id_fkey"
            columns: ["lote_id"]
            isOneToOne: false
            referencedRelation: "pagos_proveedor_lote"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pagos_proveedor_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pagos_proveedor_proveedor_factura_id_fkey"
            columns: ["proveedor_factura_id"]
            isOneToOne: false
            referencedRelation: "cxp_alertas_vencimiento"
            referencedColumns: ["proveedor_factura_id"]
          },
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
      pagos_proveedor_lote: {
        Row: {
          created_at: string
          created_by: string | null
          cuenta_bancaria_id: string | null
          deleted_at: string | null
          deleted_by: string | null
          fecha_pago: string
          id: string
          metodo_pago: string
          moneda: Database["public"]["Enums"]["moneda"]
          monto_total: number
          notas: string
          organization_id: string
          proveedor_id: string
          referencia: string
          tipo_cambio_usd: number | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          cuenta_bancaria_id?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          fecha_pago?: string
          id?: string
          metodo_pago?: string
          moneda: Database["public"]["Enums"]["moneda"]
          monto_total: number
          notas?: string
          organization_id: string
          proveedor_id: string
          referencia?: string
          tipo_cambio_usd?: number | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          cuenta_bancaria_id?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          fecha_pago?: string
          id?: string
          metodo_pago?: string
          moneda?: Database["public"]["Enums"]["moneda"]
          monto_total?: number
          notas?: string
          organization_id?: string
          proveedor_id?: string
          referencia?: string
          tipo_cambio_usd?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "pagos_proveedor_lote_cuenta_bancaria_id_fkey"
            columns: ["cuenta_bancaria_id"]
            isOneToOne: false
            referencedRelation: "cuentas_bancarias"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pagos_proveedor_lote_proveedor_id_fkey"
            columns: ["proveedor_id"]
            isOneToOne: false
            referencedRelation: "proveedores"
            referencedColumns: ["id"]
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
      presupuesto_categorias: {
        Row: {
          activa: boolean
          created_at: string
          id: string
          nombre: string
          orden: number
          organization_id: string
          tipo_contable: Database["public"]["Enums"]["tipo_contable_categoria"]
          updated_at: string
        }
        Insert: {
          activa?: boolean
          created_at?: string
          id?: string
          nombre: string
          orden?: number
          organization_id?: string
          tipo_contable?: Database["public"]["Enums"]["tipo_contable_categoria"]
          updated_at?: string
        }
        Update: {
          activa?: boolean
          created_at?: string
          id?: string
          nombre?: string
          orden?: number
          organization_id?: string
          tipo_contable?: Database["public"]["Enums"]["tipo_contable_categoria"]
          updated_at?: string
        }
        Relationships: []
      }
      presupuesto_mensual: {
        Row: {
          categoria_id: string
          creado_por: string | null
          created_at: string
          id: string
          monto_mxn: number
          notas: string | null
          organization_id: string
          periodo: string
          updated_at: string
        }
        Insert: {
          categoria_id: string
          creado_por?: string | null
          created_at?: string
          id?: string
          monto_mxn?: number
          notas?: string | null
          organization_id?: string
          periodo: string
          updated_at?: string
        }
        Update: {
          categoria_id?: string
          creado_por?: string | null
          created_at?: string
          id?: string
          monto_mxn?: number
          notas?: string | null
          organization_id?: string
          periodo?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "presupuesto_mensual_categoria_id_fkey"
            columns: ["categoria_id"]
            isOneToOne: false
            referencedRelation: "presupuesto_categorias"
            referencedColumns: ["id"]
          },
        ]
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
          updated_at: string | null
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
          updated_at?: string | null
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
          updated_at?: string | null
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
          {
            foreignKeyName: "proforma_conceptos_consolidados_proforma_id_fkey"
            columns: ["proforma_id"]
            isOneToOne: false
            referencedRelation: "v_proforma_factura_link"
            referencedColumns: ["proforma_id"]
          },
        ]
      }
      proforma_envios: {
        Row: {
          asunto: string | null
          cc: Json
          created_at: string
          destinatarios: Json
          enviado_por: string | null
          error: string | null
          estado: string
          id: string
          mensaje: string | null
          organization_id: string
          pdf_link_publico: string | null
          pdf_storage_path: string | null
          proforma_id: string
          snapshot_totales: Json | null
        }
        Insert: {
          asunto?: string | null
          cc?: Json
          created_at?: string
          destinatarios?: Json
          enviado_por?: string | null
          error?: string | null
          estado?: string
          id?: string
          mensaje?: string | null
          organization_id: string
          pdf_link_publico?: string | null
          pdf_storage_path?: string | null
          proforma_id: string
          snapshot_totales?: Json | null
        }
        Update: {
          asunto?: string | null
          cc?: Json
          created_at?: string
          destinatarios?: Json
          enviado_por?: string | null
          error?: string | null
          estado?: string
          id?: string
          mensaje?: string | null
          organization_id?: string
          pdf_link_publico?: string | null
          pdf_storage_path?: string | null
          proforma_id?: string
          snapshot_totales?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "proforma_envios_proforma_id_fkey"
            columns: ["proforma_id"]
            isOneToOne: false
            referencedRelation: "proformas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "proforma_envios_proforma_id_fkey"
            columns: ["proforma_id"]
            isOneToOne: false
            referencedRelation: "v_proforma_factura_link"
            referencedColumns: ["proforma_id"]
          },
        ]
      }
      proformas: {
        Row: {
          aceptada_at: string | null
          aceptada_por: string | null
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
          enviada_at: string | null
          enviada_por: string | null
          es_consolidada: boolean
          estado_aprobacion: string
          estado_cliente: string
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
          motivo_rechazo: string | null
          notas: string | null
          numero: string
          operador: string | null
          organization_id: string
          origen: string | null
          proformas_origen: string[] | null
          rechazada_at: string | null
          snapshot_emision: Json | null
          subtotal_mxn: number
          subtotal_usd: number
          tasa_iva_aplicada: number
          token_expira_at: string | null
          token_publico: string | null
          total_mxn: number
          total_usd: number
          ultimo_envio_email: string | null
          updated_at: string
        }
        Insert: {
          aceptada_at?: string | null
          aceptada_por?: string | null
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
          enviada_at?: string | null
          enviada_por?: string | null
          es_consolidada?: boolean
          estado_aprobacion?: string
          estado_cliente?: string
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
          motivo_rechazo?: string | null
          notas?: string | null
          numero: string
          operador?: string | null
          organization_id?: string
          origen?: string | null
          proformas_origen?: string[] | null
          rechazada_at?: string | null
          snapshot_emision?: Json | null
          subtotal_mxn?: number
          subtotal_usd?: number
          tasa_iva_aplicada?: number
          token_expira_at?: string | null
          token_publico?: string | null
          total_mxn?: number
          total_usd?: number
          ultimo_envio_email?: string | null
          updated_at?: string
        }
        Update: {
          aceptada_at?: string | null
          aceptada_por?: string | null
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
          enviada_at?: string | null
          enviada_por?: string | null
          es_consolidada?: boolean
          estado_aprobacion?: string
          estado_cliente?: string
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
          motivo_rechazo?: string | null
          notas?: string | null
          numero?: string
          operador?: string | null
          organization_id?: string
          origen?: string | null
          proformas_origen?: string[] | null
          rechazada_at?: string | null
          snapshot_emision?: Json | null
          subtotal_mxn?: number
          subtotal_usd?: number
          tasa_iva_aplicada?: number
          token_expira_at?: string | null
          token_publico?: string | null
          total_mxn?: number
          total_usd?: number
          ultimo_envio_email?: string | null
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
            foreignKeyName: "proformas_consolidada_en_fkey"
            columns: ["consolidada_en"]
            isOneToOne: false
            referencedRelation: "v_proforma_factura_link"
            referencedColumns: ["proforma_id"]
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
      proveedor_alias: {
        Row: {
          alias_normalizado: string
          alias_original: string | null
          created_at: string
          created_by: string | null
          id: string
          organization_id: string
          proveedor_id: string
        }
        Insert: {
          alias_normalizado: string
          alias_original?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          organization_id: string
          proveedor_id: string
        }
        Update: {
          alias_normalizado?: string
          alias_original?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          organization_id?: string
          proveedor_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "proveedor_alias_proveedor_id_fkey"
            columns: ["proveedor_id"]
            isOneToOne: false
            referencedRelation: "proveedores"
            referencedColumns: ["id"]
          },
        ]
      }
      proveedor_contactos: {
        Row: {
          area: string
          created_at: string
          created_by: string | null
          deleted_at: string | null
          deleted_by: string | null
          email: string
          es_principal: boolean
          extension: string
          id: string
          nombre: string
          notas: string | null
          organization_id: string
          proveedor_id: string
          puesto: string
          telefono: string
          updated_at: string
        }
        Insert: {
          area?: string
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          email?: string
          es_principal?: boolean
          extension?: string
          id?: string
          nombre: string
          notas?: string | null
          organization_id: string
          proveedor_id: string
          puesto?: string
          telefono?: string
          updated_at?: string
        }
        Update: {
          area?: string
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          email?: string
          es_principal?: boolean
          extension?: string
          id?: string
          nombre?: string
          notas?: string | null
          organization_id?: string
          proveedor_id?: string
          puesto?: string
          telefono?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "proveedor_contactos_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "proveedor_contactos_proveedor_id_fkey"
            columns: ["proveedor_id"]
            isOneToOne: false
            referencedRelation: "proveedores"
            referencedColumns: ["id"]
          },
        ]
      }
      proveedor_documentos: {
        Row: {
          archivo: string
          created_at: string
          deleted_at: string | null
          deleted_by: string | null
          fecha_documento: string | null
          fecha_vencimiento: string | null
          id: string
          mime_type: string | null
          nombre: string
          notas: string | null
          organization_id: string
          proveedor_id: string
          tamano_bytes: number | null
          tipo: string
          updated_at: string
          uploaded_by: string | null
        }
        Insert: {
          archivo: string
          created_at?: string
          deleted_at?: string | null
          deleted_by?: string | null
          fecha_documento?: string | null
          fecha_vencimiento?: string | null
          id?: string
          mime_type?: string | null
          nombre: string
          notas?: string | null
          organization_id: string
          proveedor_id: string
          tamano_bytes?: number | null
          tipo: string
          updated_at?: string
          uploaded_by?: string | null
        }
        Update: {
          archivo?: string
          created_at?: string
          deleted_at?: string | null
          deleted_by?: string | null
          fecha_documento?: string | null
          fecha_vencimiento?: string | null
          id?: string
          mime_type?: string | null
          nombre?: string
          notas?: string | null
          organization_id?: string
          proveedor_id?: string
          tamano_bytes?: number | null
          tipo?: string
          updated_at?: string
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "proveedor_documentos_proveedor_id_fkey"
            columns: ["proveedor_id"]
            isOneToOne: false
            referencedRelation: "proveedores"
            referencedColumns: ["id"]
          },
        ]
      }
      proveedor_facturas: {
        Row: {
          aprobacion_heredada: boolean
          aprobada_at: string | null
          aprobada_por: string | null
          archivo_pdf_url: string | null
          archivo_xml_url: string | null
          cancelada_por: string | null
          categoria_presupuesto_id: string
          created_at: string
          created_by: string | null
          deleted_at: string | null
          deleted_by: string | null
          dias_credito: number
          embarque_id: string | null
          estado: Database["public"]["Enums"]["estado_proveedor_factura"]
          estado_aprobacion: Database["public"]["Enums"]["estado_aprobacion_factura_proveedor"]
          estado_captura: string
          fecha_cancelacion: string | null
          fecha_emision: string
          fecha_programada_pago: string | null
          fecha_vencimiento: string | null
          folio_interno: string
          folio_proveedor: string
          id: string
          ieps: number
          iva: number
          justificacion_sin_vinculo: string | null
          moneda: Database["public"]["Enums"]["moneda"]
          motivo_cancelacion: string | null
          motivo_rechazo: string | null
          notas: string
          organization_id: string
          origen_carga: string
          proveedor_id: string
          proveedor_nombre: string
          retenciones: number
          rfc_proveedor: string | null
          subtotal: number
          tipo_cambio_usd: number
          total: number
          updated_at: string
          uuid_estatus_sat: string | null
          uuid_fiscal: string | null
          uuid_verificado: boolean | null
          uuid_verificado_fecha: string | null
        }
        Insert: {
          aprobacion_heredada?: boolean
          aprobada_at?: string | null
          aprobada_por?: string | null
          archivo_pdf_url?: string | null
          archivo_xml_url?: string | null
          cancelada_por?: string | null
          categoria_presupuesto_id: string
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          dias_credito?: number
          embarque_id?: string | null
          estado?: Database["public"]["Enums"]["estado_proveedor_factura"]
          estado_aprobacion?: Database["public"]["Enums"]["estado_aprobacion_factura_proveedor"]
          estado_captura?: string
          fecha_cancelacion?: string | null
          fecha_emision?: string
          fecha_programada_pago?: string | null
          fecha_vencimiento?: string | null
          folio_interno: string
          folio_proveedor: string
          id?: string
          ieps?: number
          iva?: number
          justificacion_sin_vinculo?: string | null
          moneda?: Database["public"]["Enums"]["moneda"]
          motivo_cancelacion?: string | null
          motivo_rechazo?: string | null
          notas?: string
          organization_id?: string
          origen_carga?: string
          proveedor_id: string
          proveedor_nombre?: string
          retenciones?: number
          rfc_proveedor?: string | null
          subtotal?: number
          tipo_cambio_usd?: number
          total?: number
          updated_at?: string
          uuid_estatus_sat?: string | null
          uuid_fiscal?: string | null
          uuid_verificado?: boolean | null
          uuid_verificado_fecha?: string | null
        }
        Update: {
          aprobacion_heredada?: boolean
          aprobada_at?: string | null
          aprobada_por?: string | null
          archivo_pdf_url?: string | null
          archivo_xml_url?: string | null
          cancelada_por?: string | null
          categoria_presupuesto_id?: string
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          dias_credito?: number
          embarque_id?: string | null
          estado?: Database["public"]["Enums"]["estado_proveedor_factura"]
          estado_aprobacion?: Database["public"]["Enums"]["estado_aprobacion_factura_proveedor"]
          estado_captura?: string
          fecha_cancelacion?: string | null
          fecha_emision?: string
          fecha_programada_pago?: string | null
          fecha_vencimiento?: string | null
          folio_interno?: string
          folio_proveedor?: string
          id?: string
          ieps?: number
          iva?: number
          justificacion_sin_vinculo?: string | null
          moneda?: Database["public"]["Enums"]["moneda"]
          motivo_cancelacion?: string | null
          motivo_rechazo?: string | null
          notas?: string
          organization_id?: string
          origen_carga?: string
          proveedor_id?: string
          proveedor_nombre?: string
          retenciones?: number
          rfc_proveedor?: string | null
          subtotal?: number
          tipo_cambio_usd?: number
          total?: number
          updated_at?: string
          uuid_estatus_sat?: string | null
          uuid_fiscal?: string | null
          uuid_verificado?: boolean | null
          uuid_verificado_fecha?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "proveedor_facturas_categoria_presupuesto_id_fkey"
            columns: ["categoria_presupuesto_id"]
            isOneToOne: false
            referencedRelation: "presupuesto_categorias"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "proveedor_facturas_embarque_id_fkey"
            columns: ["embarque_id"]
            isOneToOne: false
            referencedRelation: "embarques"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "proveedor_facturas_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "proveedor_facturas_proveedor_id_fkey"
            columns: ["proveedor_id"]
            isOneToOne: false
            referencedRelation: "proveedores"
            referencedColumns: ["id"]
          },
        ]
      }
      proveedor_facturas_conceptos: {
        Row: {
          cantidad: number
          clave_unidad: string | null
          concepto_costo_id: string | null
          created_at: string
          descripcion: string
          id: string
          ieps: number
          iva: number
          monto: number
          organization_id: string
          proveedor_factura_id: string
          updated_at: string | null
        }
        Insert: {
          cantidad?: number
          clave_unidad?: string | null
          concepto_costo_id?: string | null
          created_at?: string
          descripcion?: string
          id?: string
          ieps?: number
          iva?: number
          monto?: number
          organization_id?: string
          proveedor_factura_id: string
          updated_at?: string | null
        }
        Update: {
          cantidad?: number
          clave_unidad?: string | null
          concepto_costo_id?: string | null
          created_at?: string
          descripcion?: string
          id?: string
          ieps?: number
          iva?: number
          monto?: number
          organization_id?: string
          proveedor_factura_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "proveedor_facturas_conceptos_concepto_costo_id_fkey"
            columns: ["concepto_costo_id"]
            isOneToOne: false
            referencedRelation: "conceptos_costo"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "proveedor_facturas_conceptos_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "proveedor_facturas_conceptos_proveedor_factura_id_fkey"
            columns: ["proveedor_factura_id"]
            isOneToOne: false
            referencedRelation: "cxp_alertas_vencimiento"
            referencedColumns: ["proveedor_factura_id"]
          },
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
          archivo_pdf_url: string | null
          archivo_xml_url: string | null
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
          tipo_cambio: number | null
          updated_at: string
          uuid_estatus_sat: string | null
          uuid_fiscal: string | null
          uuid_verificado_fecha: string | null
        }
        Insert: {
          aprobada_at?: string | null
          aprobada_por?: string | null
          archivo_pdf_url?: string | null
          archivo_xml_url?: string | null
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
          tipo_cambio?: number | null
          updated_at?: string
          uuid_estatus_sat?: string | null
          uuid_fiscal?: string | null
          uuid_verificado_fecha?: string | null
        }
        Update: {
          aprobada_at?: string | null
          aprobada_por?: string | null
          archivo_pdf_url?: string | null
          archivo_xml_url?: string | null
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
          tipo_cambio?: number | null
          updated_at?: string
          uuid_estatus_sat?: string | null
          uuid_fiscal?: string | null
          uuid_verificado_fecha?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "proveedor_notas_credito_proveedor_factura_id_fkey"
            columns: ["proveedor_factura_id"]
            isOneToOne: false
            referencedRelation: "cxp_alertas_vencimiento"
            referencedColumns: ["proveedor_factura_id"]
          },
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
          aba_routing: string | null
          banco: string | null
          banco_direccion: string | null
          banco_intermediario: string | null
          banco_intermediario_swift: string | null
          banco_pais: string | null
          beneficiario: string | null
          categoria: Database["public"]["Enums"]["categoria_proveedor"] | null
          ciudad: string | null
          clabe: string | null
          contacto: string
          cp: string | null
          created_at: string
          deleted_at: string | null
          deleted_by: string | null
          dias_credito: number
          direccion: string | null
          email: string
          estado: string | null
          iban: string | null
          id: string
          moneda_preferida: Database["public"]["Enums"]["moneda"]
          nombre: string
          organization_id: string
          origen_proveedor:
            | Database["public"]["Enums"]["origen_proveedor"]
            | null
          pais: string | null
          referencia_pago: string | null
          regimen_fiscal: string | null
          rfc: string
          subtipo_gasto:
            | Database["public"]["Enums"]["subtipo_gasto_operativo"]
            | null
          swift_bic: string | null
          telefono: string
          tipo: Database["public"]["Enums"]["tipo_proveedor"] | null
          updated_at: string
        }
        Insert: {
          aba_routing?: string | null
          banco?: string | null
          banco_direccion?: string | null
          banco_intermediario?: string | null
          banco_intermediario_swift?: string | null
          banco_pais?: string | null
          beneficiario?: string | null
          categoria?: Database["public"]["Enums"]["categoria_proveedor"] | null
          ciudad?: string | null
          clabe?: string | null
          contacto?: string
          cp?: string | null
          created_at?: string
          deleted_at?: string | null
          deleted_by?: string | null
          dias_credito?: number
          direccion?: string | null
          email?: string
          estado?: string | null
          iban?: string | null
          id?: string
          moneda_preferida?: Database["public"]["Enums"]["moneda"]
          nombre: string
          organization_id?: string
          origen_proveedor?:
            | Database["public"]["Enums"]["origen_proveedor"]
            | null
          pais?: string | null
          referencia_pago?: string | null
          regimen_fiscal?: string | null
          rfc?: string
          subtipo_gasto?:
            | Database["public"]["Enums"]["subtipo_gasto_operativo"]
            | null
          swift_bic?: string | null
          telefono?: string
          tipo?: Database["public"]["Enums"]["tipo_proveedor"] | null
          updated_at?: string
        }
        Update: {
          aba_routing?: string | null
          banco?: string | null
          banco_direccion?: string | null
          banco_intermediario?: string | null
          banco_intermediario_swift?: string | null
          banco_pais?: string | null
          beneficiario?: string | null
          categoria?: Database["public"]["Enums"]["categoria_proveedor"] | null
          ciudad?: string | null
          clabe?: string | null
          contacto?: string
          cp?: string | null
          created_at?: string
          deleted_at?: string | null
          deleted_by?: string | null
          dias_credito?: number
          direccion?: string | null
          email?: string
          estado?: string | null
          iban?: string | null
          id?: string
          moneda_preferida?: Database["public"]["Enums"]["moneda"]
          nombre?: string
          organization_id?: string
          origen_proveedor?:
            | Database["public"]["Enums"]["origen_proveedor"]
            | null
          pais?: string | null
          referencia_pago?: string | null
          regimen_fiscal?: string | null
          rfc?: string
          subtipo_gasto?:
            | Database["public"]["Enums"]["subtipo_gasto_operativo"]
            | null
          swift_bic?: string | null
          telefono?: string
          tipo?: Database["public"]["Enums"]["tipo_proveedor"] | null
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
      provisioning_log: {
        Row: {
          accion: string
          created_at: string
          created_by: string | null
          detalles: Json
          entidad: string
          filas_afectadas: number
          id: string
          organization_id: string
          source: string
        }
        Insert: {
          accion: string
          created_at?: string
          created_by?: string | null
          detalles?: Json
          entidad: string
          filas_afectadas?: number
          id?: string
          organization_id: string
          source: string
        }
        Update: {
          accion?: string
          created_at?: string
          created_by?: string | null
          detalles?: Json
          entidad?: string
          filas_afectadas?: number
          id?: string
          organization_id?: string
          source?: string
        }
        Relationships: [
          {
            foreignKeyName: "provisioning_log_organization_id_fkey"
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
      refacturaciones: {
        Row: {
          cerrado_at: string | null
          cliente_destino_id: string
          cliente_origen_id: string | null
          created_at: string
          created_by: string | null
          embarque_id: string | null
          estado: string
          factura_nueva_id: string | null
          factura_original_id: string
          id: string
          motivo: string
          organization_id: string
          pago_nuevo_id: string | null
          pago_original_id: string | null
          paso_actual: number
          ruta_fiscal: string
          updated_at: string
        }
        Insert: {
          cerrado_at?: string | null
          cliente_destino_id: string
          cliente_origen_id?: string | null
          created_at?: string
          created_by?: string | null
          embarque_id?: string | null
          estado?: string
          factura_nueva_id?: string | null
          factura_original_id: string
          id?: string
          motivo?: string
          organization_id: string
          pago_nuevo_id?: string | null
          pago_original_id?: string | null
          paso_actual?: number
          ruta_fiscal?: string
          updated_at?: string
        }
        Update: {
          cerrado_at?: string | null
          cliente_destino_id?: string
          cliente_origen_id?: string | null
          created_at?: string
          created_by?: string | null
          embarque_id?: string | null
          estado?: string
          factura_nueva_id?: string | null
          factura_original_id?: string
          id?: string
          motivo?: string
          organization_id?: string
          pago_nuevo_id?: string | null
          pago_original_id?: string | null
          paso_actual?: number
          ruta_fiscal?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "refacturaciones_factura_nueva_id_fkey"
            columns: ["factura_nueva_id"]
            isOneToOne: false
            referencedRelation: "facturas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "refacturaciones_factura_original_id_fkey"
            columns: ["factura_original_id"]
            isOneToOne: false
            referencedRelation: "facturas"
            referencedColumns: ["id"]
          },
        ]
      }
      role_change_log: {
        Row: {
          changed_by: string | null
          created_at: string
          from_role: string | null
          id: string
          motivo: string | null
          organization_id: string | null
          source: string
          to_role: string
          user_id: string
        }
        Insert: {
          changed_by?: string | null
          created_at?: string
          from_role?: string | null
          id?: string
          motivo?: string | null
          organization_id?: string | null
          source: string
          to_role: string
          user_id: string
        }
        Update: {
          changed_by?: string | null
          created_at?: string
          from_role?: string | null
          id?: string
          motivo?: string | null
          organization_id?: string | null
          source?: string
          to_role?: string
          user_id?: string
        }
        Relationships: []
      }
      seguros_embarque: {
        Row: {
          aseguradora: string
          certificado_url: string | null
          cobertura_descripcion: string | null
          contacto: string | null
          created_at: string
          created_by: string | null
          deducible: number
          deleted_at: string | null
          embarque_id: string
          id: string
          moneda: string
          notas: string | null
          numero_poliza: string
          organization_id: string
          prima: number
          suma_asegurada: number
          updated_at: string
          updated_by: string | null
          vigencia_desde: string
          vigencia_hasta: string
        }
        Insert: {
          aseguradora: string
          certificado_url?: string | null
          cobertura_descripcion?: string | null
          contacto?: string | null
          created_at?: string
          created_by?: string | null
          deducible?: number
          deleted_at?: string | null
          embarque_id: string
          id?: string
          moneda?: string
          notas?: string | null
          numero_poliza: string
          organization_id: string
          prima?: number
          suma_asegurada?: number
          updated_at?: string
          updated_by?: string | null
          vigencia_desde: string
          vigencia_hasta: string
        }
        Update: {
          aseguradora?: string
          certificado_url?: string | null
          cobertura_descripcion?: string | null
          contacto?: string | null
          created_at?: string
          created_by?: string | null
          deducible?: number
          deleted_at?: string | null
          embarque_id?: string
          id?: string
          moneda?: string
          notas?: string | null
          numero_poliza?: string
          organization_id?: string
          prima?: number
          suma_asegurada?: number
          updated_at?: string
          updated_by?: string | null
          vigencia_desde?: string
          vigencia_hasta?: string
        }
        Relationships: [
          {
            foreignKeyName: "seguros_embarque_embarque_id_fkey"
            columns: ["embarque_id"]
            isOneToOne: false
            referencedRelation: "embarques"
            referencedColumns: ["id"]
          },
        ]
      }
      super_admin_org_activa: {
        Row: {
          created_at: string
          organization_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          organization_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          organization_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "super_admin_org_activa_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      suppressed_emails: {
        Row: {
          created_at: string
          email: string
          id: string
          metadata: Json | null
          reason: string
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          metadata?: Json | null
          reason: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          metadata?: Json | null
          reason?: string
        }
        Relationships: []
      }
      tipos_cambio_dof: {
        Row: {
          created_at: string
          eur_mxn: number | null
          fecha: string
          fecha_publicacion_usd: string | null
          fuente: string
          origen: string
          updated_at: string
          usd_mxn: number
        }
        Insert: {
          created_at?: string
          eur_mxn?: number | null
          fecha: string
          fecha_publicacion_usd?: string | null
          fuente?: string
          origen?: string
          updated_at?: string
          usd_mxn: number
        }
        Update: {
          created_at?: string
          eur_mxn?: number | null
          fecha?: string
          fecha_publicacion_usd?: string | null
          fuente?: string
          origen?: string
          updated_at?: string
          usd_mxn?: number
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
          expires_at: string
          id: string
          organization_id: string
          token: string
        }
        Insert: {
          created_at?: string | null
          created_by?: string
          embarque_id: string
          expires_at?: string
          id?: string
          organization_id?: string
          token?: string
        }
        Update: {
          created_at?: string | null
          created_by?: string
          embarque_id?: string
          expires_at?: string
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
      traspasos_bancarios: {
        Row: {
          client_request_id: string | null
          comision: number
          concepto: string
          created_at: string
          created_by: string | null
          cuenta_destino_id: string
          cuenta_origen_id: string
          deleted_at: string | null
          estado: string
          fecha: string
          folio: string
          id: string
          moneda_destino: Database["public"]["Enums"]["moneda"]
          moneda_origen: Database["public"]["Enums"]["moneda"]
          monto_destino: number
          monto_origen: number
          motivo_cancelacion: string
          organization_id: string
          referencia: string
          tipo_cambio: number
          updated_at: string
        }
        Insert: {
          client_request_id?: string | null
          comision?: number
          concepto?: string
          created_at?: string
          created_by?: string | null
          cuenta_destino_id: string
          cuenta_origen_id: string
          deleted_at?: string | null
          estado?: string
          fecha: string
          folio: string
          id?: string
          moneda_destino: Database["public"]["Enums"]["moneda"]
          moneda_origen: Database["public"]["Enums"]["moneda"]
          monto_destino: number
          monto_origen: number
          motivo_cancelacion?: string
          organization_id?: string
          referencia?: string
          tipo_cambio?: number
          updated_at?: string
        }
        Update: {
          client_request_id?: string | null
          comision?: number
          concepto?: string
          created_at?: string
          created_by?: string | null
          cuenta_destino_id?: string
          cuenta_origen_id?: string
          deleted_at?: string | null
          estado?: string
          fecha?: string
          folio?: string
          id?: string
          moneda_destino?: Database["public"]["Enums"]["moneda"]
          moneda_origen?: Database["public"]["Enums"]["moneda"]
          monto_destino?: number
          monto_origen?: number
          motivo_cancelacion?: string
          organization_id?: string
          referencia?: string
          tipo_cambio?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "traspasos_bancarios_cuenta_destino_id_fkey"
            columns: ["cuenta_destino_id"]
            isOneToOne: false
            referencedRelation: "cuentas_bancarias"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "traspasos_bancarios_cuenta_origen_id_fkey"
            columns: ["cuenta_origen_id"]
            isOneToOne: false
            referencedRelation: "cuentas_bancarias"
            referencedColumns: ["id"]
          },
        ]
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
      vendedora_config: {
        Row: {
          activa: boolean
          created_at: string
          fecha_alta: string
          id: string
          organization_id: string
          porcentaje_default: number
          updated_at: string
          user_id: string
        }
        Insert: {
          activa?: boolean
          created_at?: string
          fecha_alta?: string
          id?: string
          organization_id: string
          porcentaje_default?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          activa?: boolean
          created_at?: string
          fecha_alta?: string
          id?: string
          organization_id?: string
          porcentaje_default?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      costeo_tarifas_vigentes_v: {
        Row: {
          agente_id: string | null
          agente_nombre: string | null
          dias_credito: number | null
          dias_libres_almacenaje_lcl: number | null
          dias_libres_demoras: number | null
          estado: string | null
          flete_base: number | null
          frecuencia_resuelta: string | null
          id: string | null
          moneda: string | null
          naviera_carta_garantia_activa: boolean | null
          naviera_carta_garantia_vigente_hasta: string | null
          naviera_condicion_id: string | null
          naviera_demora_dia_6: number | null
          naviera_dias_libres_default: number | null
          naviera_frecuencia: string | null
          naviera_id: string | null
          naviera_nombre: string | null
          naviera_tiene_carta_garantia: boolean | null
          organization_id: string | null
          puerto_destino_id: string | null
          puerto_destino_nombre: string | null
          puerto_origen_id: string | null
          puerto_origen_nombre: string | null
          recargos_total: number | null
          ruta_id: string | null
          tarifa_frecuencia_override: string | null
          tipo_contenedor_id: string | null
          tipo_contenedor_nombre: string | null
          total_comparable: number | null
          transit_time_dias: number | null
          vigente_desde: string | null
          vigente_hasta: string | null
        }
        Relationships: [
          {
            foreignKeyName: "costeo_rutas_puerto_destino_id_fkey"
            columns: ["puerto_destino_id"]
            isOneToOne: false
            referencedRelation: "puertos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "costeo_rutas_puerto_origen_id_fkey"
            columns: ["puerto_origen_id"]
            isOneToOne: false
            referencedRelation: "puertos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "costeo_tarifas_agente_id_fkey"
            columns: ["agente_id"]
            isOneToOne: false
            referencedRelation: "costeo_agentes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "costeo_tarifas_naviera_id_fkey"
            columns: ["naviera_id"]
            isOneToOne: false
            referencedRelation: "navieras"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "costeo_tarifas_ruta_id_fkey"
            columns: ["ruta_id"]
            isOneToOne: false
            referencedRelation: "costeo_rutas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "costeo_tarifas_tipo_contenedor_id_fkey"
            columns: ["tipo_contenedor_id"]
            isOneToOne: false
            referencedRelation: "tipos_contenedor"
            referencedColumns: ["id"]
          },
        ]
      }
      cxp_alertas_vencimiento: {
        Row: {
          dias_a_vencer: number | null
          estado: string | null
          fecha_vencimiento: string | null
          folio_interno: string | null
          folio_proveedor: string | null
          moneda: Database["public"]["Enums"]["moneda"] | null
          organization_id: string | null
          proveedor_factura_id: string | null
          proveedor_id: string | null
          proveedor_nombre: string | null
          saldo: number | null
        }
        Relationships: [
          {
            foreignKeyName: "proveedor_facturas_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "proveedor_facturas_proveedor_id_fkey"
            columns: ["proveedor_id"]
            isOneToOne: false
            referencedRelation: "proveedores"
            referencedColumns: ["id"]
          },
        ]
      }
      embarques_interno_v: {
        Row: {
          cerrado_snapshot: Json | null
          created_by_email: string | null
          id: string | null
          organization_id: string | null
          reabierto_motivo: string | null
          tarifa_delta_jsonb: Json | null
        }
        Relationships: []
      }
      v_pagos_rep_pendientes: {
        Row: {
          cliente_id: string | null
          dias_restantes: number | null
          embarque_id: string | null
          factura_id: string | null
          factura_numero: string | null
          factura_serie: string | null
          factura_uuid: string | null
          fecha_limite_rep: string | null
          fecha_pago: string | null
          moneda: Database["public"]["Enums"]["moneda"] | null
          monto_aplicado_factura: number | null
          organization_id: string | null
          pago_id: string | null
          tipo_cambio: number | null
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
            foreignKeyName: "pagos_factura_factura_id_fkey"
            columns: ["factura_id"]
            isOneToOne: false
            referencedRelation: "facturas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pagos_factura_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      v_proforma_factura_link: {
        Row: {
          cliente_id: string | null
          es_consolidada: boolean | null
          estado_proforma: string | null
          estado_revision: string | null
          factura_estado: Database["public"]["Enums"]["estado_factura"] | null
          factura_id: string | null
          factura_numero: string | null
          organization_id: string | null
          proforma_id: string | null
          proforma_numero: string | null
          proformas_origen: string[] | null
          timbrado_en: string | null
          uuid_fiscal: string | null
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
            foreignKeyName: "proformas_factura_id_fkey"
            columns: ["factura_id"]
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
        Relationships: [
          {
            foreignKeyName: "proveedor_facturas_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      v_saldos_cuentas_bancarias: {
        Row: {
          cuenta_bancaria_id: string | null
          total_abonos: number | null
          total_cargos: number | null
        }
        Relationships: [
          {
            foreignKeyName: "bbva_movimientos_cuenta_bancaria_id_fkey"
            columns: ["cuenta_bancaria_id"]
            isOneToOne: false
            referencedRelation: "cuentas_bancarias"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      _assert_facturapi_admin: {
        Args: { p_org_id: string }
        Returns: undefined
      }
      _assert_internal_reader: { Args: { p_org: string }; Returns: undefined }
      _assert_medidas_embarque: {
        Args: { p_embarque: Json }
        Returns: undefined
      }
      _assert_receptor_fiscal_valido: {
        Args: { p_cliente_id: string }
        Returns: undefined
      }
      _assert_refacturador: { Args: { p_org: string }; Returns: undefined }
      _assert_writer: { Args: { p_org: string }; Returns: undefined }
      _assert_writer_cotizacion: { Args: { p_org: string }; Returns: undefined }
      _audit_costos_repetidos: {
        Args: { p_organization_id: string }
        Returns: Json
      }
      _audit_embarques_agregar: {
        Args: { p_hallazgos: Json; p_umbrales: Json }
        Returns: Json
      }
      _audit_embarques_umbrales: {
        Args: { p_organization_id: string }
        Returns: {
          dias_borrador_abandonado: number
          dias_cxc_vencida: number
          dias_cxp_captura: number
          dias_cxp_vencida: number
          dias_huerfano: number
          dias_prof_venc: number
          margen_min_pct: number
        }[]
      }
      _auditoria_embarques_org_base: {
        Args: { p_organization_id: string }
        Returns: Json
      }
      _calcular_demoras_montos_contenedor: {
        Args: {
          p_cond_id: string
          p_dias_excedidos: number
          p_moneda_default: string
          p_org: string
          p_tipo_cont_id: string
        }
        Returns: {
          moneda_costo: string
          monto_costo: number
          monto_venta: number
        }[]
      }
      _convertir_proformas_insertar_conceptos: {
        Args: {
          p_es_consolidada: boolean
          p_factura_id: string
          p_moneda: Database["public"]["Enums"]["moneda"]
          p_org: string
          p_proforma_ids: string[]
        }
        Returns: undefined
      }
      _crear_embarque_replicar_conceptos: {
        Args: {
          p_conceptos_venta: Json
          p_cotizacion_id: string
          p_embarque_id: string
          p_org: string
          p_target_ids: string[]
        }
        Returns: undefined
      }
      _crm_vincular_cotizacion_core: {
        Args: {
          p_actor_email?: string
          p_actor_id?: string
          p_cotizacion_id: string
          p_lead_id?: string
          p_oportunidad_id?: string
          p_prospecto?: Json
        }
        Returns: Json
      }
      _cxp_anchor_fase_o: { Args: never; Returns: undefined }
      _cxp_desvincular_por_rechazo: {
        Args: { p_id: string; p_motivo: string }
        Returns: Json
      }
      _cxp_validar_aprobacion: {
        Args: { p_factura_id: string; p_justificacion?: string }
        Returns: undefined
      }
      _dashboard_details_calc: { Args: never; Returns: Json }
      _dashboard_summary_calc: { Args: never; Returns: Json }
      _docs_requeridos_por_estado: {
        Args: { p_estado: string; p_modo: string }
        Returns: string[]
      }
      _es_rol_interno: { Args: never; Returns: boolean }
      _log_provisioning_step: {
        Args: {
          p_accion: string
          p_detalles?: Json
          p_entidad: string
          p_filas: number
          p_org_id: string
          p_source: string
        }
        Returns: undefined
      }
      _nc_aplicadas_moneda_factura: {
        Args: { p_factura_id: string }
        Returns: number
      }
      _recalc_anticipo_saldo: {
        Args: { p_anticipo_id: string }
        Returns: undefined
      }
      _recalc_estado_proveedor_factura: {
        Args: { p_factura_id: string }
        Returns: undefined
      }
      _recompute_totales_embarque: {
        Args: { p_embarque_id: string }
        Returns: undefined
      }
      _refact_reps_bloqueantes: {
        Args: { p_factura_id: string }
        Returns: {
          bloqueantes: number
          en_verificacion: number
        }[]
      }
      _reprocesar_comisiones_org: {
        Args: { p_org: string }
        Returns: {
          procesadas: number
          resueltas: number
        }[]
      }
      _resolver_proveedor_por_nombre: {
        Args: { p_nombre: string; p_org: string }
        Returns: string
      }
      _rfc_valido: {
        Args: { p_permitir_generico?: boolean; p_rfc: string }
        Returns: boolean
      }
      _seed_demo_limpiar_financiero: { Args: never; Returns: undefined }
      a_mxn: {
        Args: {
          p_eur_mxn: number
          p_moneda: string
          p_monto: number
          p_usd_mxn: number
        }
        Returns: number
      }
      a_mxn_doc: {
        Args: {
          _fecha: string
          _moneda: string
          _monto: number
          _tc_documento?: number
          _tc_embarque?: number
        }
        Returns: number
      }
      abrir_caso_refacturacion: {
        Args: {
          p_cliente_destino_id: string
          p_factura_id: string
          p_motivo?: string
          p_ruta_fiscal?: string
        }
        Returns: string
      }
      aceptar_cotizacion_version: {
        Args: { p_cotizacion_id: string }
        Returns: Json
      }
      aceptar_proforma_sin_autorizacion: {
        Args: { p_proforma_id: string }
        Returns: Json
      }
      actividad_embarque: {
        Args: { p_embarque_id: string }
        Returns: {
          accion: string
          categoria: string
          dedupe_key: string
          descripcion: string
          detalles: Json
          fecha: string
          id: string
          moneda: string
          monto: number
          ref_id: string
          ref_tipo: string
          tipo: string
          titulo: string
          usuario: string
        }[]
      }
      actualizar_cotizacion_costos: {
        Args: { p_costos: Json; p_cotizacion_id: string; p_request_id?: string }
        Returns: Json
      }
      actualizar_datos_entrante: {
        Args: {
          p_documento_id: string
          p_moneda_declarada: string
          p_monto_declarado: number
          p_nota: string
          p_proveedor_id: string
          p_sin_costo_capturado: boolean
        }
        Returns: undefined
      }
      actualizar_embarque_completo: {
        Args: {
          p_conceptos_costo?: Json
          p_conceptos_venta?: Json
          p_embarque: Json
          p_embarque_id: string
          p_expected_updated_at?: string
          p_request_id?: string
        }
        Returns: Json
      }
      actualizar_estado_cliente_proforma: {
        Args: { p_motivo?: string; p_proforma_id: string; p_respuesta: string }
        Returns: Json
      }
      actualizar_tarifa_con_recargos_rpc: {
        Args: { p_id: string; p_recargos: Json; p_tarifa: Json }
        Returns: undefined
      }
      actualizar_tc_embarque_dof: {
        Args: { _embarque_id: string; _fecha?: string }
        Returns: Json
      }
      adjuntar_xml_entrante_verificado: {
        Args: {
          p_actor: string
          p_documento_id: string
          p_fecha_emision?: string
          p_folio_serie?: string
          p_moneda_detectada?: string
          p_rfc_emisor?: string
          p_subtotal_detectado?: number
          p_total_detectado?: number
          p_uuid_fiscal?: string
          p_xml_hash: string
          p_xml_nombre: string
          p_xml_path: string
        }
        Returns: undefined
      }
      adjuntar_xml_factura_entrante: {
        Args: {
          p_documento_id: string
          p_fecha_emision?: string
          p_folio_serie?: string
          p_moneda_detectada?: string
          p_rfc_emisor?: string
          p_total_detectado?: number
          p_uuid_fiscal?: string
          p_xml_hash: string
          p_xml_nombre: string
          p_xml_path: string
        }
        Returns: undefined
      }
      agente_aprobar_tarifa: {
        Args: { _estado: string; _motivo?: string; _tarifa_id: string }
        Returns: undefined
      }
      alertas_sistema_pending_count: { Args: never; Returns: number }
      aplicar_anticipo_a_factura: {
        Args: {
          p_anticipo_id: string
          p_factura_id: string
          p_fecha_aplicacion?: string
          p_monto: number
          p_request_id?: string
        }
        Returns: {
          anticipo_id: string
          created_at: string
          created_by: string | null
          deleted_at: string | null
          deleted_by: string | null
          fecha_aplicacion: string
          id: string
          moneda_aplicada: Database["public"]["Enums"]["moneda"]
          monto_aplicado: number
          organization_id: string
          pago_proveedor_id: string
          proveedor_factura_id: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "anticipos_aplicaciones"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      aplicar_plantilla_cotizacion: {
        Args: { _plantilla_id: string }
        Returns: Json
      }
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
      aprobar_factura_proveedor: {
        Args: { p_aprobar: boolean; p_id: string; p_motivo?: string }
        Returns: {
          aprobacion_heredada: boolean
          aprobada_at: string | null
          aprobada_por: string | null
          archivo_pdf_url: string | null
          archivo_xml_url: string | null
          cancelada_por: string | null
          categoria_presupuesto_id: string
          created_at: string
          created_by: string | null
          deleted_at: string | null
          deleted_by: string | null
          dias_credito: number
          embarque_id: string | null
          estado: Database["public"]["Enums"]["estado_proveedor_factura"]
          estado_aprobacion: Database["public"]["Enums"]["estado_aprobacion_factura_proveedor"]
          estado_captura: string
          fecha_cancelacion: string | null
          fecha_emision: string
          fecha_programada_pago: string | null
          fecha_vencimiento: string | null
          folio_interno: string
          folio_proveedor: string
          id: string
          ieps: number
          iva: number
          justificacion_sin_vinculo: string | null
          moneda: Database["public"]["Enums"]["moneda"]
          motivo_cancelacion: string | null
          motivo_rechazo: string | null
          notas: string
          organization_id: string
          origen_carga: string
          proveedor_id: string
          proveedor_nombre: string
          retenciones: number
          rfc_proveedor: string | null
          subtotal: number
          tipo_cambio_usd: number
          total: number
          updated_at: string
          uuid_estatus_sat: string | null
          uuid_fiscal: string | null
          uuid_verificado: boolean | null
          uuid_verificado_fecha: string | null
        }
        SetofOptions: {
          from: "*"
          to: "proveedor_facturas"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      aprobar_nota_credito_proveedor: {
        Args: { _nc_id: string }
        Returns: undefined
      }
      archivar_version_cotizacion: {
        Args: { p_cotizacion_id: string; p_motivo?: string }
        Returns: number
      }
      asignar_conceptos_a_proforma: {
        Args: { p_concepto_ids: string[]; p_proforma_id: string }
        Returns: {
          aceptada_at: string | null
          aceptada_por: string | null
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
          enviada_at: string | null
          enviada_por: string | null
          es_consolidada: boolean
          estado_aprobacion: string
          estado_cliente: string
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
          motivo_rechazo: string | null
          notas: string | null
          numero: string
          operador: string | null
          organization_id: string
          origen: string | null
          proformas_origen: string[] | null
          rechazada_at: string | null
          snapshot_emision: Json | null
          subtotal_mxn: number
          subtotal_usd: number
          tasa_iva_aplicada: number
          token_expira_at: string | null
          token_publico: string | null
          total_mxn: number
          total_usd: number
          ultimo_envio_email: string | null
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "proformas"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      assert_proformas_moneda_soportada: {
        Args: { p_proforma_ids: string[] }
        Returns: undefined
      }
      assert_transicion_embarque: {
        Args: {
          p_actual: Database["public"]["Enums"]["estado_embarque"]
          p_expediente: string
          p_nuevo: Database["public"]["Enums"]["estado_embarque"]
        }
        Returns: undefined
      }
      auditoria_capturar_snapshot: {
        Args: { p_organization_id: string }
        Returns: string
      }
      auditoria_embarques_org:
        | { Args: never; Returns: Json }
        | { Args: { p_organization_id: string }; Returns: Json }
      auditoria_pfc_huerfanos: {
        Args: never
        Returns: {
          concepto_costo_id_huerfano: string
          descripcion: string
          embarque_id: string
          expediente: string
          folio_interno: string
          monto: number
          organization_id: string
          pfc_id: string
          proveedor_factura_id: string
        }[]
      }
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
      backfill_conceptos_venta_facturados: {
        Args: never
        Returns: {
          conceptos_actualizados: number
          embarques_afectados: number
          organization_id: string
        }[]
      }
      backfill_proformas_aceptadas: {
        Args: never
        Returns: {
          organization_id: string
          proformas_actualizadas: number
        }[]
      }
      backfill_tc_dof_documentos: {
        Args: { _simulacion?: boolean }
        Returns: {
          actualizados: number
          tabla: string
        }[]
      }
      buscar_factura_proveedor_por_uuid: {
        Args: { p_uuid: string }
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
      calc_cancelacion_vence: {
        Args: { p_solicitada: string }
        Returns: string
      }
      calcular_comision_pago: {
        Args: { p_pago_factura_id: string }
        Returns: undefined
      }
      calcular_costo_demoras: {
        Args: {
          p_dias_excedidos: number
          p_naviera_condicion_id: string
          p_tipo_contenedor_id: string
        }
        Returns: {
          desglose: Json
          moneda: string
          total: number
        }[]
      }
      calcular_demoras_embarque: {
        Args: { p_embarque_id: string }
        Returns: Json
      }
      can_admin_tenant: { Args: { _user_id: string }; Returns: boolean }
      can_manage_document_object: {
        Args: { _object_name: string }
        Returns: boolean
      }
      can_view_financials: { Args: { _user_id: string }; Returns: boolean }
      cancelar_anticipo_proveedor: {
        Args: { p_id: string; p_motivo: string }
        Returns: {
          created_at: string
          created_by: string | null
          cuenta_bancaria_id: string | null
          deleted_at: string | null
          deleted_by: string | null
          devuelto_at: string | null
          devuelto_by: string | null
          embarque_id: string | null
          estado: string
          fecha_anticipo: string
          id: string
          metodo_pago: string | null
          moneda: Database["public"]["Enums"]["moneda"]
          monto: number
          monto_devuelto: number | null
          motivo_cancelacion: string | null
          motivo_devolucion: string | null
          notas: string | null
          organization_id: string
          proveedor_id: string
          referencia: string | null
          saldo_disponible: number
          tipo_cambio_usd: number | null
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "anticipos_proveedor"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      cancelar_factura_proveedor: {
        Args: { p_factura_id: string; p_motivo: string }
        Returns: undefined
      }
      cancelar_liquidacion_comision: {
        Args: { p_liquidacion_id: string; p_motivo: string }
        Returns: {
          cancelada_at: string | null
          cancelada_por: string | null
          creada_por: string | null
          created_at: string
          deleted_at: string | null
          deleted_by: string | null
          estado: string
          fecha_pago: string | null
          id: string
          metodo_pago: string | null
          motivo_cancelacion: string | null
          notas: string | null
          organization_id: string
          periodo: string
          referencia: string | null
          total_mxn: number
          updated_at: string
          vendedora_id: string
        }
        SetofOptions: {
          from: "*"
          to: "liquidaciones_comision"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      cancelar_traspaso_bancario: {
        Args: { p_motivo?: string; p_traspaso_id: string }
        Returns: undefined
      }
      capturar_factura_entrante: {
        Args: { p_documento_id: string; p_factura_id: string }
        Returns: undefined
      }
      cartera_pendiente: {
        Args: never
        Returns: {
          cancellation_status: string
          cliente_id: string
          cliente_nombre: string
          dias_vencido: number
          embarque_id: string
          estado: string
          expediente: string
          factura_id: string
          fecha_emision: string
          fecha_vencimiento: string
          moneda: string
          numero: string
          pagado: number
          saldo: number
          total: number
          ultimo_contacto: string
        }[]
      }
      cerrar_caso_refacturacion: {
        Args: { p_cancelar?: boolean; p_caso_id: string }
        Returns: undefined
      }
      cerrar_embarque: { Args: { p_embarque_id: string }; Returns: Json }
      cerrar_factura_proveedor_sin_pago: {
        Args: { p_comentario?: string; p_factura_id: string; p_motivo: string }
        Returns: string
      }
      check_ratelimit: {
        Args: { p_key: string; p_max?: number; p_window_seconds?: number }
        Returns: Json
      }
      cierre_periodo_actual: { Args: never; Returns: string }
      cierre_periodo_fecha: { Args: { p_org: string }; Returns: string }
      clear_facturapi_api_key: {
        Args: { p_ambiente: string; p_org_id: string }
        Returns: undefined
      }
      cliente_requiere_autorizacion: {
        Args: { p_cliente_id: string; p_tipo: string }
        Returns: boolean
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
          limite_credito_mxn: number
          nombre: string
          rfc: string
          saldo_pendiente_mxn: number
          telefono: string
          total_cotizaciones: number
          total_count: number
          total_embarques: number
        }[]
      }
      cobranza_agregados: {
        Args: { p_cliente_id?: string; p_moneda?: string }
        Returns: Json
      }
      cobranza_listado: {
        Args: {
          p_cliente_id?: string
          p_estatus?: string
          p_limit?: number
          p_moneda?: string
          p_search?: string
        }
        Returns: {
          cliente_id: string
          cliente_nombre: string
          dias_vencido: number
          estado_factura: string
          estatus_cobranza: string
          expediente: string
          fecha_emision: string
          fecha_vencimiento: string
          id: string
          moneda: string
          notas_credito_aplicadas: number
          numero: string
          pagado: number
          saldo: number
          tipo_cambio: number
          total: number
        }[]
      }
      comision_embarques_de_factura: {
        Args: { p_factura_id: string }
        Returns: string[]
      }
      comisiones_sobre_devengadas: {
        Args: never
        Returns: {
          comision_mxn: number
          embarque_id: string
          facturas: number
          proporcion_total: number
          utilidad_prorrateada_mxn: number
        }[]
      }
      complete_onboarding: {
        Args: {
          _direccion: string
          _moneda: string
          _organization_id: string
          _rfc: string
        }
        Returns: Json
      }
      conciliacion_resumen: {
        Args: { p_cuenta_bancaria_id: string }
        Returns: Json
      }
      conciliar_tesoreria_proveedor: {
        Args: { p_factura_id?: string; p_proveedor_id?: string }
        Returns: Json
      }
      consolidar_proformas: {
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
          aceptada_at: string | null
          aceptada_por: string | null
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
          enviada_at: string | null
          enviada_por: string | null
          es_consolidada: boolean
          estado_aprobacion: string
          estado_cliente: string
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
          motivo_rechazo: string | null
          notas: string | null
          numero: string
          operador: string | null
          organization_id: string
          origen: string | null
          proformas_origen: string[] | null
          rechazada_at: string | null
          snapshot_emision: Json | null
          subtotal_mxn: number
          subtotal_usd: number
          tasa_iva_aplicada: number
          token_expira_at: string | null
          token_publico: string | null
          total_mxn: number
          total_usd: number
          ultimo_envio_email: string | null
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "proformas"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      convertir_a_mxn: {
        Args: {
          _moneda: string
          _monto: number
          _tc_eur: number
          _tc_usd: number
        }
        Returns: number
      }
      convertir_lead_rpc: {
        Args: {
          p_cliente_id: string
          p_crear_cliente: boolean
          p_fecha_estimada_cierre: string
          p_lead_id: string
          p_moneda: string
          p_monto_estimado: number
          p_nombre_oportunidad: string
        }
        Returns: Json
      }
      convertir_monto_dof: {
        Args: {
          p_fecha: string
          p_moneda_destino: string
          p_moneda_origen: string
          p_monto: number
        }
        Returns: number
      }
      convertir_monto_pago_a_factura: {
        Args: {
          p_moneda_fact: Database["public"]["Enums"]["moneda"]
          p_moneda_pago: Database["public"]["Enums"]["moneda"]
          p_monto: number
          p_tc_fact: number
          p_tc_pago: number
        }
        Returns: number
      }
      convertir_proformas_a_factura: {
        Args: {
          p_dias_credito?: number
          p_forma_pago: string
          p_metodo_pago: string
          p_notas?: string
          p_proforma_ids: string[]
          p_request_id?: string
          p_serie_id: string
          p_uso_cfdi: string
        }
        Returns: {
          acuse_cancelacion_fecha: string | null
          acuse_cancelacion_status: string | null
          acuse_cancelacion_xml: string | null
          ambiente: Database["public"]["Enums"]["ambiente_facturapi"] | null
          cancelacion_motivo: string | null
          cancelacion_solicitada_en: string | null
          cancelacion_vence_en: string | null
          cancelado_en: string | null
          cancellation_status: string | null
          cliente_id: string
          cliente_nombre: string
          cotizacion_id: string | null
          created_at: string
          deleted_at: string | null
          deleted_by: string | null
          dias_credito: number | null
          embarque_id: string | null
          enviada_cliente_at: string | null
          estado: Database["public"]["Enums"]["estado_factura"]
          expediente: string
          factura_pdf_url: string | null
          factura_xml_backup_path: string | null
          factura_xml_url: string | null
          facturapi_claim_at: string | null
          facturapi_id: string | null
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
          origen: Database["public"]["Enums"]["origen_factura"]
          proforma_id: string | null
          referencia_bl: string | null
          ret_isr: number
          ret_iva: number
          rfc_cliente: string | null
          serie: string | null
          serie_id: string | null
          snapshot_emision: Json | null
          subtotal: number
          sustituida_por: string | null
          sustituye_a: string | null
          timbrado_en: string | null
          timbrado_por: string | null
          tipo_cambio: number | null
          total: number
          updated_at: string
          uso_cfdi: string | null
          uuid_estatus_sat: string | null
          uuid_fiscal: string | null
          uuid_verificado: boolean
          uuid_verificado_fecha: string | null
        }[]
        SetofOptions: {
          from: "*"
          to: "facturas"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      convertir_proformas_a_factura_check_embarque_vivo: {
        Args: { p_proforma_ids: string[] }
        Returns: undefined
      }
      convertir_prospecto_a_cliente_rpc: {
        Args: { p_cliente: Json; p_cotizacion_id: string }
        Returns: Json
      }
      costeo_tarifa_estado_actual: {
        Args: { p_estado: string; p_vigente_hasta: string }
        Returns: string
      }
      cotizacion_totales_conceptos: {
        Args: { p_conceptos: Json }
        Returns: {
          iva_mxn: number
          iva_usd: number
          subtotal_mxn: number
          subtotal_usd: number
          total_mxn: number
          total_usd: number
        }[]
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
      crear_ajustes_factura_proveedor_rpc: {
        Args: { p_ajustes: Json; p_factura_id: string }
        Returns: Json
      }
      crear_clientes: {
        Args: { p_clientes: Json }
        Returns: {
          ciudad: string
          codigo_postal: string | null
          contacto: string
          cp: string
          created_at: string
          deleted_at: string | null
          deleted_by: string | null
          dias_credito: number | null
          direccion: string
          email: string
          email_cc_default: string[] | null
          email_destinatarios_default: string[] | null
          estado: string
          forma_pago_default: string | null
          id: string
          limite_credito_mxn: number | null
          metodo_pago_default: string | null
          nombre: string
          organization_id: string
          regimen_fiscal: string | null
          requiere_autorizacion_cotizacion: boolean
          requiere_autorizacion_proforma: boolean
          rfc: string
          sin_comision: boolean
          telefono: string
          updated_at: string
          uso_cfdi_default: string | null
        }[]
        SetofOptions: {
          from: "*"
          to: "clientes"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      crear_embarque_borrador_core: {
        Args: { p_cotizacion_id: string }
        Returns: string
      }
      crear_embarque_borrador_desde_cotizacion: {
        Args: {
          p_cotizacion_id: string
          p_decision?: string
          p_delta_jsonb?: Json
          p_tarifa_id_aplicada?: string
        }
        Returns: string
      }
      crear_embarque_completo: {
        Args: {
          p_conceptos_costo?: Json
          p_conceptos_venta?: Json
          p_contenedores?: Json
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
          aceptada_at: string | null
          aceptada_por: string | null
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
          enviada_at: string | null
          enviada_por: string | null
          es_consolidada: boolean
          estado_aprobacion: string
          estado_cliente: string
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
          motivo_rechazo: string | null
          notas: string | null
          numero: string
          operador: string | null
          organization_id: string
          origen: string | null
          proformas_origen: string[] | null
          rechazada_at: string | null
          snapshot_emision: Json | null
          subtotal_mxn: number
          subtotal_usd: number
          tasa_iva_aplicada: number
          token_expira_at: string | null
          token_publico: string | null
          total_mxn: number
          total_usd: number
          ultimo_envio_email: string | null
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "proformas"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      credito_en_uso_mxn: { Args: { p_cliente_id: string }; Returns: number }
      crm_autorizar_margen: {
        Args: { _margen_pct: number; _oportunidad_id: string }
        Returns: undefined
      }
      crm_avance_actividad: {
        Args: { p_desde: string; p_hasta: string }
        Returns: {
          contactos: number
          contactos_efectivos: number
          cotizaciones: number
          reuniones_calificadas: number
          vendedor_email: string
        }[]
      }
      crm_backfill_cotizaciones_sin_oportunidad: { Args: never; Returns: Json }
      crm_calificar_prospecto: { Args: { p_lead_id: string }; Returns: Json }
      crm_criterios_avance: {
        Args: { p_oportunidad_ids: string[] }
        Returns: {
          cumplidos: number
          etapa_id: string
          obligatorios_pendientes: number
          oportunidad_id: string
          total: number
        }[]
      }
      crm_embudo_conversion: {
        Args: { p_desde: string; p_hasta: string }
        Returns: {
          conversion_desde_anterior: number
          entradas: number
          etapa_id: string
          etapa_nombre: string
          oportunidades: number
          orden: number
          ponderado: number
          probabilidad_default: number
          valor: number
        }[]
      }
      crm_higiene_oportunidades: {
        Args: never
        Returns: {
          actividad_vencida: boolean
          cliente_nombre: string
          dias_sin_movimiento: number
          estado_higiene: string
          etapa_id: string
          etapa_nombre: string
          fecha_estimada_cierre: string
          id: string
          moneda: string
          monto_estimado: number
          nombre: string
          probabilidad: number
          proxima_actividad_at: string
          registro_completo: boolean
          sla_dias: number
          ultimo_movimiento_at: string
          vendedor_email: string
        }[]
      }
      crm_higiene_pipeline: {
        Args: never
        Returns: {
          abiertas: number
          higiene_pct: number
          pipeline_bruto: number
          pipeline_ponderado: number
          registros_completos: number
          seguimiento_oportuno_pct: number
          sin_actividad_programada: number
          tc_estimado: boolean
          tc_fecha: string
          vencidas: number
        }[]
      }
      crm_leads_buscar_duplicados: {
        Args: { p_claves: Json }
        Returns: {
          contacto: string
          email: string
          email_norm: string
          empresa: string
          empresa_norm: string
          estado: Database["public"]["Enums"]["crm_lead_estado"]
          id: string
          telefono: string
          telefono_norm: string
        }[]
      }
      crm_propagar_conversion_cliente: {
        Args: {
          p_cliente_id: string
          p_cliente_nombre: string
          p_oportunidad_id: string
        }
        Returns: Json
      }
      crm_tomar_lead: { Args: { p_lead_id: string }; Returns: Json }
      crm_vincular_cotizacion: {
        Args: {
          p_cotizacion_id: string
          p_lead_id?: string
          p_oportunidad_id?: string
          p_prospecto?: Json
        }
        Returns: Json
      }
      cron_try_lock: {
        Args: { p_key: string; p_owner?: string; p_ttl_seconds?: number }
        Returns: boolean
      }
      cron_unlock: { Args: { p_key: string }; Returns: undefined }
      current_agente_id: { Args: never; Returns: string }
      current_agente_org: { Args: never; Returns: string }
      current_agente_proveedor_id: { Args: never; Returns: string }
      current_user_client_ids: { Args: never; Returns: string[] }
      current_user_org_id: { Args: never; Returns: string }
      cxc_aging_clientes: {
        Args: { p_fecha?: string; p_org?: string }
        Returns: {
          cliente_id: string
          cliente_nombre: string
          d_1_30: number
          d_31_60: number
          d_61_90: number
          mas_90: number
          moneda: string
          num_facturas: number
          saldo_total: number
          vigente: number
        }[]
      }
      cxp_aging_proveedores: {
        Args: { p_fecha?: string; p_org?: string }
        Returns: {
          d_1_30: number
          d_31_60: number
          d_61_90: number
          mas_90: number
          moneda: string
          num_facturas: number
          proveedor_id: string
          proveedor_nombre: string
          saldo_total: number
          vigente: number
        }[]
      }
      cxp_alertas_vencimiento: {
        Args: { p_dias?: number }
        Returns: {
          dias_a_vencer: number | null
          estado: string | null
          fecha_vencimiento: string | null
          folio_interno: string | null
          folio_proveedor: string | null
          moneda: Database["public"]["Enums"]["moneda"] | null
          organization_id: string | null
          proveedor_factura_id: string | null
          proveedor_id: string | null
          proveedor_nombre: string | null
          saldo: number | null
        }[]
        SetofOptions: {
          from: "*"
          to: "cxp_alertas_vencimiento"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      cxp_pendientes_aprobacion_count: { Args: never; Returns: number }
      cxp_por_capturar: {
        Args: never
        Returns: {
          cliente_nombre: string
          dias_desde_ultima_factura: number
          embarque_id: string
          expediente: string
          facturado_mxn: number
          facturado_usd: number
          facturas_capturadas: number
          presupuestado_mxn: number
          presupuestado_usd: number
          ultima_factura_fecha: string
        }[]
      }
      cxp_por_pagar: {
        Args: never
        Returns: {
          dias_para_vencer: number
          embarque_id: string
          estado_captura: string
          expediente: string
          factura_id: string
          fecha_emision: string
          fecha_programada_pago: string
          fecha_vencimiento: string
          folio_proveedor: string
          moneda: string
          pagado: number
          proveedor_id: string
          proveedor_nombre: string
          proveedor_origen: string
          saldo: number
          tipo_cambio_usd: number
          total: number
        }[]
      }
      cxp_umbral_sin_vinculo: { Args: { p_org: string }; Returns: number }
      cxp_umbral_sin_vinculo_actual: { Args: never; Returns: number }
      dashboard_details: { Args: never; Returns: Json }
      dashboard_details_datos: { Args: never; Returns: Json }
      dashboard_facturacion_kpis: {
        Args: { p_fallback_usd?: number; p_meses?: number }
        Returns: Json
      }
      dashboard_stats: { Args: never; Returns: Json }
      dashboard_summary: { Args: never; Returns: Json }
      dashboard_summary_datos: { Args: never; Returns: Json }
      default_user_org_id: { Args: never; Returns: string }
      delete_email: {
        Args: { message_id: number; queue_name: string }
        Returns: boolean
      }
      detectar_alertas_app_logs: { Args: never; Returns: number }
      devolver_anticipo_proveedor: {
        Args: {
          p_cuenta_bancaria_id: string
          p_fecha: string
          p_id: string
          p_monto: number
          p_motivo?: string
          p_referencia?: string
        }
        Returns: {
          created_at: string
          created_by: string | null
          cuenta_bancaria_id: string | null
          deleted_at: string | null
          deleted_by: string | null
          devuelto_at: string | null
          devuelto_by: string | null
          embarque_id: string | null
          estado: string
          fecha_anticipo: string
          id: string
          metodo_pago: string | null
          moneda: Database["public"]["Enums"]["moneda"]
          monto: number
          monto_devuelto: number | null
          motivo_cancelacion: string | null
          motivo_devolucion: string | null
          notas: string | null
          organization_id: string
          proveedor_id: string
          referencia: string | null
          saldo_disponible: number
          tipo_cambio_usd: number | null
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "anticipos_proveedor"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      direccion_totales: { Args: { p_desde: string }; Returns: Json }
      duplicar_cotizacion: { Args: { p_id: string }; Returns: string }
      duplicar_embarque_completo: {
        Args: {
          p_copias: Json
          p_embarque_origen_id: string
          p_request_id?: string
        }
        Returns: Json
      }
      duplicar_factura_para_refacturacion: {
        Args: { p_caso_id: string }
        Returns: string
      }
      duplicar_factura_para_sustitucion: {
        Args: { p_factura_id: string }
        Returns: string
      }
      eerr_resumen_anual: {
        Args: { p_fuente?: string; p_year: number }
        Returns: {
          costos_mxn: number
          excluidos_sin_tc: number
          ingresos_mxn: number
          mes: number
        }[]
      }
      ejecutar_pago_programado: {
        Args: {
          p_cuenta_bancaria_id: string
          p_factura_id: string
          p_fecha: string
          p_metodo_pago?: string
          p_monto: number
          p_referencia?: string
          p_request_id?: string
        }
        Returns: Json
      }
      eliminar_embarque_completo: {
        Args: { p_embarque_id: string }
        Returns: undefined
      }
      eliminar_factura_borrador: {
        Args: { p_factura_id: string }
        Returns: undefined
      }
      eliminar_organizacion_vacia: {
        Args: { p_org_id: string }
        Returns: undefined
      }
      eliminar_pago_cliente: {
        Args: { _motivo?: string; _pago_id: string }
        Returns: Json
      }
      eliminar_pago_proveedor: {
        Args: { _motivo?: string; _pago_id: string }
        Returns: Json
      }
      eliminar_proforma_rpc: { Args: { p_proforma_id: string }; Returns: Json }
      email_queue_dispatch: { Args: never; Returns: undefined }
      email_send_log_touch: {
        Args: {
          p_error?: string
          p_message_id: string
          p_recipient: string
          p_status: string
          p_template: string
        }
        Returns: undefined
      }
      embarque_admin_pendientes_resumen: {
        Args: { p_embarque_id: string }
        Returns: Json
      }
      embarque_docs_faltantes: {
        Args: { p_embarque_id: string; p_estado_destino: string }
        Returns: string[]
      }
      embarque_estado_financiero: {
        Args: { _embarque_id: string }
        Returns: Json
      }
      embarque_operativo_completo: {
        Args: { p_embarque_id: string }
        Returns: boolean
      }
      embarques_admin_pendientes_count: { Args: never; Returns: number }
      embarques_alertas_ids: {
        Args: never
        Returns: {
          embarque_id: string
          tipo: string
        }[]
      }
      embarques_internos_src: {
        Args: never
        Returns: {
          cerrado_snapshot: Json
          created_by_email: string
          id: string
          organization_id: string
          reabierto_motivo: string
          tarifa_delta_jsonb: Json
        }[]
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
          tipo_carga: string
          tipo_contenedor: string
          total_count: number
        }[]
      }
      enforce_cotizacion_vigente: {
        Args: { p_cotizacion_id: string }
        Returns: undefined
      }
      enforce_revalidacion_sin_cambios: {
        Args: { p_cotizacion_id: string }
        Returns: undefined
      }
      enmascarar_costos_jsonb: { Args: { p_in: Json }; Returns: Json }
      enqueue_email: {
        Args: { payload: Json; queue_name: string }
        Returns: number
      }
      ensure_demo_membership: { Args: { _user_id: string }; Returns: undefined }
      es_admin_catalogo: { Args: { _uid: string }; Returns: boolean }
      es_escritor_financiero: { Args: { _uid: string }; Returns: boolean }
      estado_cuenta_agregados: {
        Args: { p_cliente_ids: string[]; p_desde?: string; p_hasta?: string }
        Returns: Json
      }
      estado_cuenta_bancario: {
        Args: { p_cuenta_bancaria_id: string; p_desde: string; p_hasta: string }
        Returns: Json
      }
      expirar_cotizaciones_job: { Args: never; Returns: Json }
      facturacion_por_emitir: {
        Args: never
        Returns: {
          cliente_id: string
          cliente_nombre: string
          dias_desde_emision: number
          embarque_id: string
          expediente: string
          numero_proforma: string
          proforma_id: string
          total: number
        }[]
      }
      facturas_cartera_cliente: {
        Args: { p_cliente_id: string; p_desde?: string; p_hasta?: string }
        Returns: {
          cliente_id: string
          cliente_nombre: string
          estado: string
          fecha_emision: string
          fecha_vencimiento: string
          folio: string
          id: string
          moneda: string
          numero: string
          organization_id: string
          saldo: number
          serie: string
          total: number
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
          acuse_cancelacion_status: string
          ambiente: Database["public"]["Enums"]["ambiente_facturapi"]
          cancellation_status: string
          cliente_nombre: string
          enviada_cliente_at: string
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
      fn_admin_org_activity: {
        Args: never
        Returns: {
          cotizaciones: number
          embarques: number
          id: string
          nombre: string
        }[]
      }
      fn_admin_org_counts: {
        Args: { _org: string }
        Returns: {
          clientes: number
          cotizaciones: number
          embarques: number
          miembros: number
        }[]
      }
      fn_admin_platform_stats: {
        Args: never
        Returns: {
          total_cotizaciones: number
          total_embarques: number
          total_orgs: number
          total_users: number
        }[]
      }
      generar_expediente: { Args: { tipo_op: string }; Returns: string }
      generar_liquidacion_comision: {
        Args: {
          p_organization_id: string
          p_periodo: string
          p_request_id?: string
          p_vendedora_id: string
        }
        Returns: string
      }
      generar_numero_proforma: { Args: { p_org_id: string }; Returns: string }
      generar_token_proforma: {
        Args: { p_dias_vigencia?: number; p_proforma_id: string }
        Returns: Json
      }
      get_agente_rutas: {
        Args: never
        Returns: {
          activa: boolean
          id: string
          organization_id: string
          puerto_destino_id: string
          puerto_destino_nombre: string
          puerto_origen_id: string
          puerto_origen_nombre: string
        }[]
      }
      get_current_agente_context: {
        Args: never
        Returns: {
          agente_id: string
          agente_nombre: string
          organizacion_nombre: string
          organization_id: string
          proveedor_id: string
        }[]
      }
      get_current_agente_org_nombre: { Args: never; Returns: string }
      get_embarque_full: { Args: { p_embarque_id: string }; Returns: Json }
      get_exposicion_credito_cliente: {
        Args: { p_cliente_id: string }
        Returns: {
          cliente_id: string
          dias_credito: number
          disponible_mxn: number
          en_uso_mxn: number
          excedido: boolean
          facturas_vivas: number
          limite_mxn: number
          organization_id: string
        }[]
      }
      get_facturapi_api_key_internal: {
        Args: { p_ambiente: string; p_org_id: string }
        Returns: string
      }
      get_operadores_para_cotizacion: {
        Args: { p_cotizacion_id: string }
        Returns: {
          email: string
          user_id: string
        }[]
      }
      get_top_tarifas: {
        Args: {
          p_fecha?: string
          p_organization_id?: string
          p_puerto_destino_id: string
          p_puerto_origen_id: string
          p_tipo_contenedor_id: string
        }
        Returns: {
          agente_id: string | null
          agente_nombre: string | null
          dias_credito: number | null
          dias_libres_almacenaje_lcl: number | null
          dias_libres_demoras: number | null
          estado: string | null
          flete_base: number | null
          frecuencia_resuelta: string | null
          id: string | null
          moneda: string | null
          naviera_carta_garantia_activa: boolean | null
          naviera_carta_garantia_vigente_hasta: string | null
          naviera_condicion_id: string | null
          naviera_demora_dia_6: number | null
          naviera_dias_libres_default: number | null
          naviera_frecuencia: string | null
          naviera_id: string | null
          naviera_nombre: string | null
          naviera_tiene_carta_garantia: boolean | null
          organization_id: string | null
          puerto_destino_id: string | null
          puerto_destino_nombre: string | null
          puerto_origen_id: string | null
          puerto_origen_nombre: string | null
          recargos_total: number | null
          ruta_id: string | null
          tarifa_frecuencia_override: string | null
          tipo_contenedor_id: string | null
          tipo_contenedor_nombre: string | null
          total_comparable: number | null
          transit_time_dias: number | null
          vigente_desde: string | null
          vigente_hasta: string | null
        }[]
        SetofOptions: {
          from: "*"
          to: "costeo_tarifas_vigentes_v"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      get_top_tarifas_por_codigo: {
        Args: {
          p_contenedor_code: string
          p_destino_code: string
          p_fecha?: string
          p_organization_id?: string
          p_origen_code: string
        }
        Returns: {
          agente_id: string | null
          agente_nombre: string | null
          dias_credito: number | null
          dias_libres_almacenaje_lcl: number | null
          dias_libres_demoras: number | null
          estado: string | null
          flete_base: number | null
          frecuencia_resuelta: string | null
          id: string | null
          moneda: string | null
          naviera_carta_garantia_activa: boolean | null
          naviera_carta_garantia_vigente_hasta: string | null
          naviera_condicion_id: string | null
          naviera_demora_dia_6: number | null
          naviera_dias_libres_default: number | null
          naviera_frecuencia: string | null
          naviera_id: string | null
          naviera_nombre: string | null
          naviera_tiene_carta_garantia: boolean | null
          organization_id: string | null
          puerto_destino_id: string | null
          puerto_destino_nombre: string | null
          puerto_origen_id: string | null
          puerto_origen_nombre: string | null
          recargos_total: number | null
          ruta_id: string | null
          tarifa_frecuencia_override: string | null
          tipo_contenedor_id: string | null
          tipo_contenedor_nombre: string | null
          total_comparable: number | null
          transit_time_dias: number | null
          vigente_desde: string | null
          vigente_hasta: string | null
        }[]
        SetofOptions: {
          from: "*"
          to: "costeo_tarifas_vigentes_v"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      get_tracking_public: { Args: { p_token: string }; Returns: Json }
      get_user_context: { Args: never; Returns: Json }
      get_user_org_ids: { Args: { _user_id: string }; Returns: string[] }
      has_any_role: {
        Args: {
          _roles: Database["public"]["Enums"]["app_role"][]
          _user_id: string
        }
        Returns: boolean
      }
      has_any_role_efectivo: {
        Args: {
          _roles: Database["public"]["Enums"]["app_role"][]
          _user_id: string
        }
        Returns: boolean
      }
      has_any_role_in_org: {
        Args: {
          _org: string
          _roles: Database["public"]["Enums"]["app_role"][]
          _user_id: string
        }
        Returns: boolean
      }
      has_any_role_in_org_exact: {
        Args: {
          _org: string
          _roles: Database["public"]["Enums"]["app_role"][]
          _user_id: string
        }
        Returns: boolean
      }
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
      has_role_in_org: {
        Args: {
          _org: string
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      historial_factura: {
        Args: { p_factura_id: string; p_limite?: number }
        Returns: {
          accion: string
          created_at: string
          detalles: Json
          entidad_id: string
          entidad_nombre: string
          id: string
          modulo: string
          usuario_email: string
          usuario_id: string
        }[]
      }
      historial_proveedor_factura: {
        Args: { p_id: string }
        Returns: {
          actor_email: string
          descripcion: string
          detalles: Json
          moneda: string
          monto: number
          tipo: string
          ts: string
        }[]
      }
      idempotency_claim: { Args: { _fn: string; _key: string }; Returns: Json }
      idempotency_store: {
        Args: { _key: string; _response: Json }
        Returns: undefined
      }
      is_demo_user: { Args: { _user_id: string }; Returns: boolean }
      is_finance: { Args: { _user_id: string }; Returns: boolean }
      is_operations: { Args: { _user_id: string }; Returns: boolean }
      is_org_admin: {
        Args: { _org_id: string; _user_id: string }
        Returns: boolean
      }
      is_org_member: { Args: { p_org: string }; Returns: boolean }
      is_sales: { Args: { _user_id: string }; Returns: boolean }
      is_soft_delete_table: { Args: { _table: string }; Returns: boolean }
      liberar_claim_facturapi_huerfano: {
        Args: { p_factura_id: string; p_min_edad_minutos?: number }
        Returns: boolean
      }
      liberar_claim_rep_huerfano: {
        Args: { p_min_edad_minutos?: number; p_pago_id: string }
        Returns: boolean
      }
      liberar_conceptos_de_proforma: {
        Args: { p_proforma_id: string }
        Returns: number
      }
      libro_pagos: {
        Args: { p_desde: string; p_hasta: string; p_org?: string }
        Returns: Json
      }
      limpiar_cancellation_status_verificado: {
        Args: { p_factura_id: string; p_remote_cancellation_status: string }
        Returns: Json
      }
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
      list_trash_counts: {
        Args: never
        Returns: {
          tabla: string
          total: number
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
      marcar_facturas_vencidas: { Args: never; Returns: number }
      marcar_proforma_facturada: {
        Args: {
          p_fecha: string
          p_folio: string
          p_id: string
          p_request_id?: string
        }
        Returns: undefined
      }
      materializar_factura_retencion_garantia: {
        Args: { p_garantia_id: string }
        Returns: string
      }
      migrar_roles_legacy_dry_run: { Args: never; Returns: Json }
      migrar_roles_legacy_ejecutar: { Args: never; Returns: Json }
      monto_pago_en_moneda_factura: {
        Args: {
          p_moneda_factura: string
          p_moneda_pago: string
          p_monto: number
          p_tc_pago: number
        }
        Returns: number
      }
      move_to_dlq: {
        Args: {
          dlq_name: string
          message_id: number
          payload: Json
          source_queue: string
        }
        Returns: number
      }
      nc_aplicadas_en_moneda_factura: {
        Args: { p_factura_id: string }
        Returns: number
      }
      notificacion_cliente_marcar_leida: {
        Args: { p_id: string }
        Returns: undefined
      }
      notificaciones_cliente_marcar_todas_leidas: {
        Args: never
        Returns: number
      }
      notificar_uuid_cancelado_sat: {
        Args: { p_facturas: Json; p_org: string }
        Returns: number
      }
      obtener_costos_cotizacion_version: {
        Args: { p_cotizacion_id: string; p_version?: number }
        Returns: Json[]
      }
      obtener_defaults_facturacion_cliente: {
        Args: { p_cliente_id: string }
        Returns: {
          cc_emails: string[]
          destinatarios_emails: string[]
          forma_pago: string
          metodo_pago: string
          uso_cfdi: string
        }[]
      }
      obtener_top_tarifas: {
        Args: {
          p_fecha?: string
          p_limit?: number
          p_ruta_id: string
          p_tipo_contenedor_id: string
        }
        Returns: {
          agente_nombre: string
          dias_credito: number
          dias_libres_demoras: number
          flete_base: number
          moneda: string
          naviera_nombre: string
          puerto_destino_nombre: string
          puerto_origen_nombre: string
          recargos_total: number
          tarifa_id: string
          total_comparable: number
          transit_time_dias: number
          vigente_hasta: string
        }[]
      }
      operaciones_stats: { Args: never; Returns: Json }
      operadores_distintos: {
        Args: never
        Returns: {
          operador: string
        }[]
      }
      org_requerida: { Args: { p_org: string }; Returns: string }
      org_scope: { Args: never; Returns: string }
      pago_detalle: { Args: { p_id: string; p_tipo: string }; Returns: Json }
      pnl_financiero_embarque: { Args: { _embarque_id: string }; Returns: Json }
      portal_obtener_proforma_por_token: {
        Args: { p_token: string }
        Returns: Json
      }
      portal_responder_cotizacion: {
        Args: {
          p_comentario?: string
          p_cotizacion_id: string
          p_respuesta: string
        }
        Returns: Json
      }
      portal_responder_por_token: {
        Args: { p_motivo?: string; p_respuesta: string; p_token: string }
        Returns: Json
      }
      portal_responder_proforma: {
        Args: { p_motivo?: string; p_proforma_id: string; p_respuesta: string }
        Returns: Json
      }
      portal_solicitar_cotizacion: {
        Args: {
          p_cliente_id: string
          p_descripcion_mercancia?: string
          p_destino: string
          p_modo: Database["public"]["Enums"]["modo_transporte"]
          p_notas?: string
          p_origen: string
          p_tipo: Database["public"]["Enums"]["tipo_operacion"]
          p_tipo_contenedor?: string
          p_tipo_embarque?: string
        }
        Returns: {
          folio: string
          id: string
        }[]
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
          costo_mxn: number
          costo_usd: number
          embarques_sin_tc: number
          total_embarques: number
          venta_mxn: number
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
      promover_embarque_por_liquidar: {
        Args: { p_embarque_id: string }
        Returns: boolean
      }
      proveedor_estado_cuenta: {
        Args: { p_proveedor_id: string }
        Returns: Json
      }
      proveedor_estado_cuenta_movimientos: {
        Args: {
          p_desde?: string
          p_hasta?: string
          p_limite?: number
          p_offset?: number
          p_proveedor_id: string
        }
        Returns: Json
      }
      proveedor_inteligencia: {
        Args: { p_proveedor_id: string }
        Returns: Json
      }
      proveedor_salud: { Args: { p_proveedor_id: string }; Returns: Json }
      proveedores_listado: {
        Args: {
          p_categoria?: string
          p_limit?: number
          p_offset?: number
          p_organization_id?: string
          p_origen?: string
          p_search?: string
          p_subtipo_gasto?: string
          p_tipo?: string
        }
        Returns: {
          categoria: Database["public"]["Enums"]["categoria_proveedor"]
          contacto: string
          id: string
          moneda_preferida: Database["public"]["Enums"]["moneda"]
          monto_pendiente: number
          nombre: string
          origen_proveedor: string
          pais: string
          rfc: string
          subtipo_gasto: Database["public"]["Enums"]["subtipo_gasto_operativo"]
          tipo: Database["public"]["Enums"]["tipo_proveedor"]
          total_count: number
          total_operaciones: number
        }[]
      }
      provision_organization: {
        Args: { p_nombre: string; p_owner_user_id: string; p_rfc: string }
        Returns: string
      }
      puede_escribir_cotizaciones: {
        Args: { _user_id?: string }
        Returns: boolean
      }
      puede_ver_costos_cotizacion: {
        Args: { _user_id?: string }
        Returns: boolean
      }
      puede_ver_costos_cotizacion_propia: {
        Args: { _cotizacion_id: string; _user_id?: string }
        Returns: boolean
      }
      puede_ver_costos_dashboard: {
        Args: { _user_id?: string }
        Returns: boolean
      }
      puede_ver_dashboard_direccion: {
        Args: { _user_id?: string }
        Returns: boolean
      }
      purgar_embarque_cascade: {
        Args: { p_embarque_id: string }
        Returns: undefined
      }
      purgar_facturapi_webhook_eventos: { Args: never; Returns: number }
      purge_app_logs_old: { Args: never; Returns: number }
      purge_record: {
        Args: { _id: string; _table: string }
        Returns: undefined
      }
      reabrir_embarque: {
        Args: {
          p_embarque_id: string
          p_motivo: string
          p_request_id?: string
          p_usuario_email: string
        }
        Returns: Json
      }
      reactivar_cotizacion_rpc: { Args: { p_id: string }; Returns: string }
      reactivar_factura_entrante: {
        Args: { p_documento_id: string }
        Returns: undefined
      }
      read_email_batch: {
        Args: { batch_size: number; queue_name: string; vt: number }
        Returns: {
          message: Json
          msg_id: number
          read_ct: number
        }[]
      }
      reasignar_pago_factura: {
        Args: {
          p_caso_id?: string
          p_factura_destino_id: string
          p_ordenante_nombre?: string
          p_ordenante_rfc?: string
          p_pago_id: string
        }
        Returns: string
      }
      recalc_factura_retenciones: {
        Args: { p_factura_id: string }
        Returns: undefined
      }
      recalc_factura_totales: {
        Args: { p_factura_id: string }
        Returns: undefined
      }
      recalcular_cobro_embarques: {
        Args: { p_embarque_ids: string[] }
        Returns: undefined
      }
      recalcular_estado_liquidacion_concepto: {
        Args: { p_concepto_id: string }
        Returns: undefined
      }
      recalcular_estado_liquidacion_factura: {
        Args: { p_factura_id: string }
        Returns: undefined
      }
      recalcular_subtotal_cotizacion: {
        Args: { p_cotizacion_id: string }
        Returns: number
      }
      rechazar_documento_embarque: {
        Args: { _doc_id: string; _motivo: string }
        Returns: undefined
      }
      rechazar_factura_entrante: {
        Args: { p_documento_id: string; p_motivo: string }
        Returns: undefined
      }
      recompute_embarque_tiene_proforma: {
        Args: { p_embarque_id: string }
        Returns: undefined
      }
      recotizar_cotizacion: {
        Args: { p_cotizacion_id: string; p_motivo: string }
        Returns: Json
      }
      reemplazar_conceptos_entrante: {
        Args: { p_conceptos: Json; p_documento_id: string }
        Returns: number
      }
      reemplazar_conceptos_factura_proveedor: {
        Args: { p_conceptos: Json; p_factura_id: string }
        Returns: number
      }
      refacturacion_expediente: { Args: { p_caso_id: string }; Returns: Json }
      refacturacion_set_paso: {
        Args: { p_caso_id: string; p_paso: number }
        Returns: undefined
      }
      refacturacion_simular_paso: {
        Args: { p_caso_id: string; p_paso: number }
        Returns: Json
      }
      refacturacion_validar_consistencia: {
        Args: { p_caso_id: string }
        Returns: Json
      }
      refrescar_garantia_desde_tarifa: {
        Args: { p_embarque_id: string }
        Returns: number
      }
      regenerar_movimiento_pago_proveedor: {
        Args: { p_pago_id: string }
        Returns: string
      }
      registrar_anticipo_proveedor: {
        Args: {
          p_cuenta_bancaria_id?: string
          p_embarque_id?: string
          p_fecha_anticipo?: string
          p_metodo_pago?: string
          p_moneda: Database["public"]["Enums"]["moneda"]
          p_monto: number
          p_notas?: string
          p_proveedor_id: string
          p_referencia?: string
          p_request_id?: string
          p_tipo_cambio_usd?: number
        }
        Returns: {
          created_at: string
          created_by: string | null
          cuenta_bancaria_id: string | null
          deleted_at: string | null
          deleted_by: string | null
          devuelto_at: string | null
          devuelto_by: string | null
          embarque_id: string | null
          estado: string
          fecha_anticipo: string
          id: string
          metodo_pago: string | null
          moneda: Database["public"]["Enums"]["moneda"]
          monto: number
          monto_devuelto: number | null
          motivo_cancelacion: string | null
          motivo_devolucion: string | null
          notas: string | null
          organization_id: string
          proveedor_id: string
          referencia: string | null
          saldo_disponible: number
          tipo_cambio_usd: number | null
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "anticipos_proveedor"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      registrar_bitacora: {
        Args: {
          p_accion: string
          p_detalles?: Json
          p_entidad_id?: string
          p_entidad_nombre?: string
          p_modulo: string
          p_organization_id?: string
          p_usuario_id?: string
        }
        Returns: undefined
      }
      registrar_comision_pendiente: {
        Args: {
          p_etapa: string
          p_motivo: string
          p_organization_id: string
          p_pago_factura_id: string
          p_sqlerrm: string
          p_sqlstate: string
        }
        Returns: undefined
      }
      registrar_pago_cliente_lote: { Args: { p_payload: Json }; Returns: Json }
      registrar_pago_liquidacion: {
        Args: {
          p_fecha_pago: string
          p_liquidacion_id: string
          p_metodo_pago: string
          p_notas?: string
          p_referencia?: string
        }
        Returns: {
          cancelada_at: string | null
          cancelada_por: string | null
          creada_por: string | null
          created_at: string
          deleted_at: string | null
          deleted_by: string | null
          estado: string
          fecha_pago: string | null
          id: string
          metodo_pago: string | null
          motivo_cancelacion: string | null
          notas: string | null
          organization_id: string
          periodo: string
          referencia: string | null
          total_mxn: number
          updated_at: string
          vendedora_id: string
        }
        SetofOptions: {
          from: "*"
          to: "liquidaciones_comision"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      registrar_pago_proveedor_lote: {
        Args: { p_payload: Json }
        Returns: string
      }
      registrar_traspaso_bancario: {
        Args: {
          p_client_request_id?: string
          p_comision?: number
          p_concepto?: string
          p_cuenta_destino_id: string
          p_cuenta_origen_id: string
          p_fecha: string
          p_monto_origen: number
          p_referencia?: string
          p_tipo_cambio?: number
        }
        Returns: string
      }
      reportes_resumen: {
        Args: {
          p_fecha_desde?: string
          p_fecha_hasta?: string
          p_modo?: string
        }
        Returns: Json
      }
      reprocesar_comisiones_job: { Args: never; Returns: Json }
      reprocesar_comisiones_pendientes: {
        Args: { p_org?: string }
        Returns: {
          procesadas: number
          resueltas: number
        }[]
      }
      reseed_organization_catalogs: {
        Args: { p_org_id: string }
        Returns: Json
      }
      reservar_folio_factura: {
        Args: { _serie_id: string }
        Returns: {
          folio: number
          numero: string
        }[]
      }
      resolver_clave_sat: {
        Args: { p_descripcion: string; p_org: string }
        Returns: string
      }
      resolver_expediente_por_bl: {
        Args: { _bl_master: string; _tipo_op: string }
        Returns: string
      }
      resolver_porcentaje_comision: {
        Args: {
          p_cliente_id: string
          p_embarque_id: string
          p_organization_id: string
          p_vendedora_id: string
        }
        Returns: number
      }
      resolver_producto_sat: {
        Args: { p_nombre: string; p_org: string }
        Returns: {
          clave_sat: string
          clave_unidad_sat: string
          id: string
          nombre: string
          nombre_unidad: string
          tasa_iva_default: number
          tipo_iva: string
        }[]
      }
      resolver_puerto_id: { Args: { p_valor: string }; Returns: string }
      resolver_reaprobacion_tarifa: {
        Args: { p_cotizacion_id: string; p_decision: string }
        Returns: undefined
      }
      resolver_sin_comision: {
        Args: { p_embarque_id: string }
        Returns: boolean
      }
      resolver_tipo_contenedor_id: {
        Args: { p_valor: string }
        Returns: string
      }
      restaurar_embarque_cascade: {
        Args: { p_embarque_id: string }
        Returns: undefined
      }
      restore_record: {
        Args: { _id: string; _table: string }
        Returns: undefined
      }
      retirar_factura_entrante: {
        Args: { p_documento_id: string }
        Returns: undefined
      }
      revalidar_tarifa_cotizacion: {
        Args: { p_cotizacion_id: string }
        Returns: Json
      }
      revertir_proforma_al_cancelar_sustitucion: {
        Args: { p_factura_id: string }
        Returns: string[]
      }
      rls_tenant_scope_ok: { Args: { _org: string }; Returns: boolean }
      rol_efectivo: {
        Args: { _org: string; _user_id: string }
        Returns: Database["public"]["Enums"]["app_role"]
      }
      roles_jerarquia: {
        Args: { _role: Database["public"]["Enums"]["app_role"] }
        Returns: Database["public"]["Enums"]["app_role"][]
      }
      run_auditoria_backfill_legacy: { Args: never; Returns: Json }
      saldo_cuenta_bancaria: { Args: { p_cuenta_id: string }; Returns: number }
      saldo_factura: { Args: { p_factura_id: string }; Returns: number }
      saldo_factura_bruto: { Args: { p_factura_id: string }; Returns: number }
      saldo_factura_proveedor: { Args: { p_factura_id: string }; Returns: Json }
      seed_demo_organization: { Args: never; Returns: undefined }
      seed_demo_organization_core: { Args: never; Returns: undefined }
      seed_demo_organization_guarded: {
        Args: { p_skip_ms?: number }
        Returns: boolean
      }
      seed_presupuesto_categorias: {
        Args: { p_organization_id: string }
        Returns: undefined
      }
      seleccionar_lote_sat_semanal: {
        Args: { p_max_orgs?: number }
        Returns: {
          organization_id: string
        }[]
      }
      set_facturapi_api_key: {
        Args: { p_ambiente: string; p_api_key: string; p_org_id: string }
        Returns: undefined
      }
      set_garantia_estado: {
        Args: {
          p_estado?: string
          p_fecha_deposito?: string
          p_fecha_liberacion?: string
          p_id: string
          p_monto?: number
          p_notas?: string
          p_referencia?: string
        }
        Returns: {
          created_at: string
          deleted_at: string | null
          deleted_by: string | null
          embarque_contenedor_id: string
          embarque_id: string
          estado: string
          fecha_deposito: string | null
          fecha_liberacion: string | null
          fecha_limite_devolucion: string | null
          id: string
          monto_deposito_usd: number
          naviera_id: string | null
          notas: string | null
          organization_id: string
          proveedor_factura_id: string | null
          referencia_deposito: string | null
          tiene_carta_garantia: boolean
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "embarque_garantias_contenedor"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      set_super_admin_org: { Args: { p_org: string }; Returns: undefined }
      sidebar_alert_counts: {
        Args: never
        Returns: {
          embarques_demora: number
          facturas_vencidas: number
          garantias_atoradas: number
        }[]
      }
      siguiente_folio_cotizacion: { Args: never; Returns: string }
      siguiente_folio_cotizacion_prospecto: { Args: never; Returns: string }
      siguiente_folio_proveedor: { Args: { p_org_id: string }; Returns: string }
      siguiente_folio_traspaso: { Args: { p_org_id: string }; Returns: string }
      sincronizar_contenedores_embarque: {
        Args: { p_contenedores: Json; p_embarque_id: string }
        Returns: {
          bl_house: string | null
          created_at: string
          deleted_at: string | null
          deleted_by: string | null
          dias_libres_override: number | null
          embarque_id: string
          fecha_descarga: string | null
          fecha_devolucion: string | null
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
      soft_delete_pago_factura: {
        Args: { p_pago_id: string }
        Returns: undefined
      }
      soft_delete_pago_proveedor: {
        Args: { p_pago_id: string }
        Returns: undefined
      }
      soft_delete_proveedor_factura: {
        Args: { p_deleted_by?: string; p_factura_id: string }
        Returns: undefined
      }
      soft_delete_record: {
        Args: { _id: string; _table: string }
        Returns: undefined
      }
      solicitar_reaprobacion_tarifa: {
        Args: { p_cotizacion_id: string; p_delta_jsonb: Json }
        Returns: undefined
      }
      sugerir_embarques_para_proveedor: {
        Args: {
          _limit?: number
          _organization_id: string
          _proveedor_id: string
        }
        Returns: {
          cliente_nombre: string
          embarque_id: string
          estado: string
          eta: string
          etd: string
          expediente: string
          match_tipo: string
          score: number
        }[]
      }
      tc_dof_cobertura_faltante: {
        Args: never
        Returns: {
          documento_id: string
          fecha: string
          moneda: string
          tabla: string
        }[]
      }
      tc_dof_moneda: {
        Args: { p_fecha: string; p_moneda: string }
        Returns: number
      }
      tc_dof_upsert_manual: {
        Args: { _eur?: number; _fecha: string; _usd: number }
        Returns: undefined
      }
      tc_dof_vigente: {
        Args: { _fecha?: string }
        Returns: {
          eur_mxn: number
          fecha: string
          fuente: string
          origen: string
          usd_mxn: number
        }[]
      }
      tc_para_documento: {
        Args: {
          _fecha: string
          _moneda: string
          _tc_documento?: number
          _tc_embarque?: number
        }
        Returns: {
          origen: string
          tc: number
        }[]
      }
      transicion_embarque_valida: {
        Args: {
          p_actual: Database["public"]["Enums"]["estado_embarque"]
          p_nuevo: Database["public"]["Enums"]["estado_embarque"]
        }
        Returns: boolean
      }
      transicion_garantia_valida: {
        Args: { next: string; prev: string }
        Returns: boolean
      }
      validar_captura_entrante: {
        Args: { p_documento_id: string }
        Returns: Json
      }
      validar_cierre_embarque: {
        Args: { p_embarque_id: string }
        Returns: Json
      }
      venta_embarque_mxn_neta: {
        Args: { p_embarque_id: string; p_tc_eur: number; p_tc_usd: number }
        Returns: number
      }
      vincular_anticipo_embarque: {
        Args: { p_embarque_id?: string; p_id: string }
        Returns: {
          created_at: string
          created_by: string | null
          cuenta_bancaria_id: string | null
          deleted_at: string | null
          deleted_by: string | null
          devuelto_at: string | null
          devuelto_by: string | null
          embarque_id: string | null
          estado: string
          fecha_anticipo: string
          id: string
          metodo_pago: string | null
          moneda: Database["public"]["Enums"]["moneda"]
          monto: number
          monto_devuelto: number | null
          motivo_cancelacion: string | null
          motivo_devolucion: string | null
          notas: string | null
          organization_id: string
          proveedor_id: string
          referencia: string | null
          saldo_disponible: number
          tipo_cambio_usd: number | null
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "anticipos_proveedor"
          isOneToOne: true
          isSetofReturn: false
        }
      }
    }
    Enums: {
      ambiente_facturapi: "sandbox" | "live"
      app_role:
        | "admin"
        | "operador"
        | "viewer"
        | "super_admin"
        | "cliente"
        | "vendedor"
        | "admin_org"
        | "gerente_operaciones"
        | "coordinador_logistico"
        | "ejecutivo_pricing"
        | "contador"
        | "tesorero"
        | "customer_service"
        | "gerente_visor"
        | "gerente_comercial"
        | "auxiliar_contable"
        | "ejecutivo_cobranza"
        | "agente_carga"
      categoria_proveedor: "Logistico" | "GastoOperativo"
      crm_actividad_tipo: "llamada" | "email" | "reunion" | "tarea" | "nota"
      crm_entidad_tipo: "lead" | "oportunidad" | "cliente" | "contacto"
      crm_etapa_tipo: "abierta" | "ganada" | "perdida"
      crm_lead_estado:
        | "Nuevo"
        | "Contactado"
        | "Calificado"
        | "Prospecto"
        | "Pendiente de alta"
        | "Descalificado"
        | "Convertido"
      crm_lead_fuente:
        | "Web"
        | "Referido"
        | "Campaña"
        | "Llamada en frío"
        | "Evento"
        | "Otro"
      estado_aprobacion_factura_proveedor:
        | "pendiente"
        | "aprobada"
        | "rechazada"
      estado_comision: "Devengada" | "Liquidada" | "Cancelada" | "Por recuperar"
      estado_conciliacion: "Pendiente" | "Conciliado" | "Ignorado"
      estado_cotizacion:
        | "Borrador"
        | "Solicitada"
        | "Enviada"
        | "Aceptada"
        | "Rechazada"
        | "Vencida"
        | "En operación"
        | "Archivada"
      estado_documento:
        | "Pendiente"
        | "Recibido"
        | "Validado"
        | "No aplica"
        | "Rechazado"
      estado_embarque:
        | "Cotización"
        | "Borrador"
        | "Confirmado"
        | "En Tránsito"
        | "Llegada"
        | "En Proceso"
        | "Por liquidar"
        | "Cerrado"
        | "En Aduana"
        | "Entregado"
        | "Cancelado"
        | "Arribo"
        | "EIR"
      estado_factura:
        | "Borrador"
        | "Por timbrar"
        | "Emitida"
        | "Pagada"
        | "Vencida"
        | "Cancelada"
        | "Parcialmente pagada"
        | "Sustituida"
      estado_hallazgo_revision: "pendiente" | "en_progreso" | "revisado"
      estado_liquidacion: "Pendiente" | "Pagado"
      estado_nota_credito:
        | "Borrador"
        | "Aprobada"
        | "Timbrada"
        | "Aplicada"
        | "Cancelada"
      estado_nota_credito_proveedor:
        | "Borrador"
        | "Aprobada"
        | "Aplicada"
        | "Cancelada"
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
      origen_factura: "proforma" | "manual" | "conversion_proforma"
      origen_proveedor: "Nacional" | "Extranjero"
      subtipo_gasto_operativo:
        | "Renta"
        | "Servicios"
        | "Papeleria"
        | "Software"
        | "Honorarios"
        | "Mantenimiento"
        | "Marketing"
        | "Viaticos"
        | "Otros"
      tipo_contable_categoria:
        | "CostoDirectoEmbarque"
        | "Venta"
        | "Administracion"
      tipo_contacto: "Exportador" | "Importador"
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
        | "Cambio de ETA"
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
      ambiente_facturapi: ["sandbox", "live"],
      app_role: [
        "admin",
        "operador",
        "viewer",
        "super_admin",
        "cliente",
        "vendedor",
        "admin_org",
        "gerente_operaciones",
        "coordinador_logistico",
        "ejecutivo_pricing",
        "contador",
        "tesorero",
        "customer_service",
        "gerente_visor",
        "gerente_comercial",
        "auxiliar_contable",
        "ejecutivo_cobranza",
        "agente_carga",
      ],
      categoria_proveedor: ["Logistico", "GastoOperativo"],
      crm_actividad_tipo: ["llamada", "email", "reunion", "tarea", "nota"],
      crm_entidad_tipo: ["lead", "oportunidad", "cliente", "contacto"],
      crm_etapa_tipo: ["abierta", "ganada", "perdida"],
      crm_lead_estado: [
        "Nuevo",
        "Contactado",
        "Calificado",
        "Prospecto",
        "Pendiente de alta",
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
      estado_aprobacion_factura_proveedor: [
        "pendiente",
        "aprobada",
        "rechazada",
      ],
      estado_comision: ["Devengada", "Liquidada", "Cancelada", "Por recuperar"],
      estado_conciliacion: ["Pendiente", "Conciliado", "Ignorado"],
      estado_cotizacion: [
        "Borrador",
        "Solicitada",
        "Enviada",
        "Aceptada",
        "Rechazada",
        "Vencida",
        "En operación",
        "Archivada",
      ],
      estado_documento: [
        "Pendiente",
        "Recibido",
        "Validado",
        "No aplica",
        "Rechazado",
      ],
      estado_embarque: [
        "Cotización",
        "Borrador",
        "Confirmado",
        "En Tránsito",
        "Llegada",
        "En Proceso",
        "Por liquidar",
        "Cerrado",
        "En Aduana",
        "Entregado",
        "Cancelado",
        "Arribo",
        "EIR",
      ],
      estado_factura: [
        "Borrador",
        "Por timbrar",
        "Emitida",
        "Pagada",
        "Vencida",
        "Cancelada",
        "Parcialmente pagada",
        "Sustituida",
      ],
      estado_hallazgo_revision: ["pendiente", "en_progreso", "revisado"],
      estado_liquidacion: ["Pendiente", "Pagado"],
      estado_nota_credito: [
        "Borrador",
        "Aprobada",
        "Timbrada",
        "Aplicada",
        "Cancelada",
      ],
      estado_nota_credito_proveedor: [
        "Borrador",
        "Aprobada",
        "Aplicada",
        "Cancelada",
      ],
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
      origen_factura: ["proforma", "manual", "conversion_proforma"],
      origen_proveedor: ["Nacional", "Extranjero"],
      subtipo_gasto_operativo: [
        "Renta",
        "Servicios",
        "Papeleria",
        "Software",
        "Honorarios",
        "Mantenimiento",
        "Marketing",
        "Viaticos",
        "Otros",
      ],
      tipo_contable_categoria: [
        "CostoDirectoEmbarque",
        "Venta",
        "Administracion",
      ],
      tipo_contacto: ["Exportador", "Importador"],
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
        "Cambio de ETA",
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
