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
          usuario_email?: string
          usuario_id?: string
        }
        Relationships: []
      }
      clientes: {
        Row: {
          ciudad: string
          contacto: string
          cp: string
          created_at: string
          direccion: string
          email: string
          estado: string
          id: string
          nombre: string
          rfc: string
          telefono: string
          updated_at: string
        }
        Insert: {
          ciudad?: string
          contacto?: string
          cp?: string
          created_at?: string
          direccion?: string
          email?: string
          estado?: string
          id?: string
          nombre: string
          rfc?: string
          telefono?: string
          updated_at?: string
        }
        Update: {
          ciudad?: string
          contacto?: string
          cp?: string
          created_at?: string
          direccion?: string
          email?: string
          estado?: string
          id?: string
          nombre?: string
          rfc?: string
          telefono?: string
          updated_at?: string
        }
        Relationships: []
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
        ]
      }
      conceptos_venta: {
        Row: {
          cantidad: number
          created_at: string
          descripcion: string
          embarque_id: string
          id: string
          moneda: Database["public"]["Enums"]["moneda"]
          precio_unitario: number
          total: number
        }
        Insert: {
          cantidad?: number
          created_at?: string
          descripcion: string
          embarque_id: string
          id?: string
          moneda?: Database["public"]["Enums"]["moneda"]
          precio_unitario?: number
          total?: number
        }
        Update: {
          cantidad?: number
          created_at?: string
          descripcion?: string
          embarque_id?: string
          id?: string
          moneda?: Database["public"]["Enums"]["moneda"]
          precio_unitario?: number
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
        ]
      }
      configuracion: {
        Row: {
          categoria: string
          clave: string
          created_at: string
          descripcion: string
          id: string
          updated_at: string
          valor: Json
        }
        Insert: {
          categoria: string
          clave: string
          created_at?: string
          descripcion?: string
          id?: string
          updated_at?: string
          valor?: Json
        }
        Update: {
          categoria?: string
          clave?: string
          created_at?: string
          descripcion?: string
          id?: string
          updated_at?: string
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
          proveedor: string
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
          proveedor?: string
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
          proveedor?: string
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
        ]
      }
      cotizaciones: {
        Row: {
          carta_garantia: boolean
          cliente_id: string | null
          cliente_nombre: string
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
          operador: string
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
          operador?: string
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
          operador?: string
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
          updated_at?: string
          validez_propuesta?: string | null
          valor_seguro_usd?: number
          vigencia_dias?: number
          volumen_m3?: number
        }
        Relationships: []
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
        }
        Insert: {
          archivo?: string | null
          created_at?: string
          embarque_id: string
          estado?: Database["public"]["Enums"]["estado_documento"]
          id?: string
          nombre: string
          notas?: string | null
        }
        Update: {
          archivo?: string | null
          created_at?: string
          embarque_id?: string
          estado?: Database["public"]["Enums"]["estado_documento"]
          id?: string
          nombre?: string
          notas?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "documentos_embarque_embarque_id_fkey"
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
          bl_house: string | null
          bl_master: string | null
          carta_porte: string | null
          ciudad_destino: string | null
          ciudad_origen: string | null
          cliente_id: string
          cliente_nombre: string
          consignatario: string
          contenedor: string | null
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
          peso_kg: number
          piezas: number
          puerto_destino: string | null
          puerto_origen: string | null
          shipper: string
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
          bl_house?: string | null
          bl_master?: string | null
          carta_porte?: string | null
          ciudad_destino?: string | null
          ciudad_origen?: string | null
          cliente_id: string
          cliente_nombre?: string
          consignatario?: string
          contenedor?: string | null
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
          peso_kg?: number
          piezas?: number
          puerto_destino?: string | null
          puerto_origen?: string | null
          shipper?: string
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
          bl_house?: string | null
          bl_master?: string | null
          carta_porte?: string | null
          ciudad_destino?: string | null
          ciudad_origen?: string | null
          cliente_id?: string
          cliente_nombre?: string
          consignatario?: string
          contenedor?: string | null
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
          peso_kg?: number
          piezas?: number
          puerto_destino?: string | null
          puerto_origen?: string | null
          shipper?: string
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
        ]
      }
      notas_embarque: {
        Row: {
          contenido: string
          created_at: string
          embarque_id: string
          fecha: string
          id: string
          tipo: Database["public"]["Enums"]["tipo_nota"]
          usuario: string
        }
        Insert: {
          contenido: string
          created_at?: string
          embarque_id: string
          fecha?: string
          id?: string
          tipo?: Database["public"]["Enums"]["tipo_nota"]
          usuario?: string
        }
        Update: {
          contenido?: string
          created_at?: string
          embarque_id?: string
          fecha?: string
          id?: string
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
          origen_proveedor?:
            | Database["public"]["Enums"]["origen_proveedor"]
            | null
          pais?: string | null
          rfc?: string
          telefono?: string
          tipo?: Database["public"]["Enums"]["tipo_proveedor"]
          updated_at?: string
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
      [_ in never]: never
    }
    Functions: {
      generar_expediente: { Args: { tipo_op: string }; Returns: string }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      resolver_expediente_por_bl: {
        Args: { _bl_master: string; _tipo_op: string }
        Returns: string
      }
    }
    Enums: {
      app_role: "admin" | "operador" | "viewer"
      estado_cotizacion:
        | "Borrador"
        | "Enviada"
        | "Confirmada"
        | "Rechazada"
        | "Vencida"
        | "Aceptada"
      estado_documento: "Pendiente" | "Recibido" | "Validado"
      estado_embarque:
        | "Cotización"
        | "Confirmado"
        | "En Tránsito"
        | "Llegada"
        | "En Proceso"
        | "Cerrado"
      estado_factura:
        | "Borrador"
        | "Emitida"
        | "Pagada"
        | "Vencida"
        | "Cancelada"
      estado_liquidacion: "Pendiente" | "Pagado"
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
      modo_transporte: "Marítimo" | "Aéreo" | "Terrestre" | "Multimodal"
      moneda: "MXN" | "USD" | "EUR"
      origen_proveedor: "Nacional" | "Extranjero"
      tipo_contacto: "Proveedor" | "Exportador" | "Importador"
      tipo_nota: "nota" | "cambio_estado" | "documento" | "factura" | "sistema"
      tipo_operacion: "Importación" | "Exportación" | "Nacional"
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
      app_role: ["admin", "operador", "viewer"],
      estado_cotizacion: [
        "Borrador",
        "Enviada",
        "Confirmada",
        "Rechazada",
        "Vencida",
        "Aceptada",
      ],
      estado_documento: ["Pendiente", "Recibido", "Validado"],
      estado_embarque: [
        "Cotización",
        "Confirmado",
        "En Tránsito",
        "Llegada",
        "En Proceso",
        "Cerrado",
      ],
      estado_factura: ["Borrador", "Emitida", "Pagada", "Vencida", "Cancelada"],
      estado_liquidacion: ["Pendiente", "Pagado"],
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
      ],
      modo_transporte: ["Marítimo", "Aéreo", "Terrestre", "Multimodal"],
      moneda: ["MXN", "USD", "EUR"],
      origen_proveedor: ["Nacional", "Extranjero"],
      tipo_contacto: ["Proveedor", "Exportador", "Importador"],
      tipo_nota: ["nota", "cambio_estado", "documento", "factura", "sistema"],
      tipo_operacion: ["Importación", "Exportación", "Nacional"],
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
