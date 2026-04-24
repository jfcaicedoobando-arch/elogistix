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
          created_at: string
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
          created_at?: string
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
          created_at?: string
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
          created_at: string
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
          created_at?: string
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
          created_at?: string
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
            foreignKeyName: "cotizaciones_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      documentos_embarque: {
        Row: {
          archivo: string | null
          created_at: string
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
          descripcion_mercancia: string
          estado: Database["public"]["Enums"]["estado_embarque"]
          eta: string | null
          etd: string | null
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
          descripcion_mercancia?: string
          estado?: Database["public"]["Enums"]["estado_embarque"]
          eta?: string | null
          etd?: string | null
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
          descripcion_mercancia?: string
          estado?: Database["public"]["Enums"]["estado_embarque"]
          eta?: string | null
          etd?: string | null
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
      facturas: {
        Row: {
          cliente_id: string
          cliente_nombre: string
          created_at: string
          embarque_id: string
          estado: Database["public"]["Enums"]["estado_factura"]
          expediente: string
          fecha_emision: string
          fecha_vencimiento: string
          id: string
          iva: number
          moneda: Database["public"]["Enums"]["moneda"]
          notas: string | null
          numero: string
          organization_id: string
          referencia_bl: string | null
          subtotal: number
          tipo_cambio: number
          total: number
          updated_at: string
        }
        Insert: {
          cliente_id: string
          cliente_nombre?: string
          created_at?: string
          embarque_id: string
          estado?: Database["public"]["Enums"]["estado_factura"]
          expediente?: string
          fecha_emision?: string
          fecha_vencimiento?: string
          id?: string
          iva?: number
          moneda?: Database["public"]["Enums"]["moneda"]
          notas?: string | null
          numero: string
          organization_id?: string
          referencia_bl?: string | null
          subtotal?: number
          tipo_cambio?: number
          total?: number
          updated_at?: string
        }
        Update: {
          cliente_id?: string
          cliente_nombre?: string
          created_at?: string
          embarque_id?: string
          estado?: Database["public"]["Enums"]["estado_factura"]
          expediente?: string
          fecha_emision?: string
          fecha_vencimiento?: string
          id?: string
          iva?: number
          moneda?: Database["public"]["Enums"]["moneda"]
          notas?: string | null
          numero?: string
          organization_id?: string
          referencia_bl?: string | null
          subtotal?: number
          tipo_cambio?: number
          total?: number
          updated_at?: string
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
        ]
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
      proformas: {
        Row: {
          bl_master: string | null
          cliente_id: string
          cliente_nombre: string
          created_at: string
          created_by: string | null
          dias_credito: number | null
          embarque_id: string
          estado_proforma: string
          expediente: string
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
          subtotal_mxn: number
          subtotal_usd: number
          total_mxn: number
          total_usd: number
          updated_at: string
        }
        Insert: {
          bl_master?: string | null
          cliente_id: string
          cliente_nombre: string
          created_at?: string
          created_by?: string | null
          dias_credito?: number | null
          embarque_id: string
          estado_proforma?: string
          expediente: string
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
          subtotal_mxn?: number
          subtotal_usd?: number
          total_mxn?: number
          total_usd?: number
          updated_at?: string
        }
        Update: {
          bl_master?: string | null
          cliente_id?: string
          cliente_nombre?: string
          created_at?: string
          created_by?: string | null
          dias_credito?: number | null
          embarque_id?: string
          estado_proforma?: string
          expediente?: string
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
          subtotal_mxn?: number
          subtotal_usd?: number
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
            foreignKeyName: "proformas_embarque_id_fkey"
            columns: ["embarque_id"]
            isOneToOne: false
            referencedRelation: "embarques"
            referencedColumns: ["id"]
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
      [_ in never]: never
    }
    Functions: {
      actualizar_embarque_completo: {
        Args: {
          p_conceptos_costo?: Json
          p_conceptos_venta?: Json
          p_embarque: Json
          p_embarque_id: string
        }
        Returns: undefined
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
      crear_embarque_completo: {
        Args: {
          p_conceptos_costo?: Json
          p_conceptos_venta?: Json
          p_documentos?: Json
          p_embarque: Json
        }
        Returns: Json
      }
      current_user_client_ids: { Args: never; Returns: string[] }
      current_user_org_id: { Args: never; Returns: string }
      dashboard_details: { Args: never; Returns: Json }
      dashboard_stats: { Args: never; Returns: Json }
      dashboard_summary: { Args: never; Returns: Json }
      duplicar_embarque_completo: {
        Args: { p_copias: Json; p_embarque_origen_id: string }
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
      generar_expediente: { Args: { tipo_op: string }; Returns: string }
      generar_numero_proforma: { Args: { p_org_id: string }; Returns: string }
      get_user_context: { Args: never; Returns: Json }
      get_user_org_ids: { Args: { _user_id: string }; Returns: string[] }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_org_admin: {
        Args: { _org_id: string; _user_id: string }
        Returns: boolean
      }
      marcar_proforma_facturada: {
        Args: { p_fecha: string; p_folio: string; p_id: string }
        Returns: undefined
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
          costo_usd: number
          embarque_id: string
          venta_usd: number
        }[]
      }
      resolver_expediente_por_bl: {
        Args: { _bl_master: string; _tipo_op: string }
        Returns: string
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
    }
    Enums: {
      app_role: "admin" | "operador" | "viewer" | "super_admin" | "cliente"
      estado_cotizacion:
        | "Borrador"
        | "Enviada"
        | "Confirmada"
        | "Rechazada"
        | "Vencida"
        | "Aceptada"
        | "Embarcada"
      estado_documento: "Pendiente" | "Recibido" | "Validado"
      estado_embarque:
        | "Cotización"
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
      estado_liquidacion: "Pendiente" | "Pagado"
      estado_proforma: "Pendiente" | "Facturada" | "Cancelada"
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
      app_role: ["admin", "operador", "viewer", "super_admin", "cliente"],
      estado_cotizacion: [
        "Borrador",
        "Enviada",
        "Confirmada",
        "Rechazada",
        "Vencida",
        "Aceptada",
        "Embarcada",
      ],
      estado_documento: ["Pendiente", "Recibido", "Validado"],
      estado_embarque: [
        "Cotización",
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
      estado_factura: ["Borrador", "Emitida", "Pagada", "Vencida", "Cancelada"],
      estado_liquidacion: ["Pendiente", "Pagado"],
      estado_proforma: ["Pendiente", "Facturada", "Cancelada"],
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
