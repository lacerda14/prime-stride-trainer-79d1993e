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
      achievements: {
        Row: {
          code: string
          criteria: Json
          description: string
          icon: string | null
          sort_order: number
          title: string
          xp_reward: number
        }
        Insert: {
          code: string
          criteria?: Json
          description: string
          icon?: string | null
          sort_order?: number
          title: string
          xp_reward?: number
        }
        Update: {
          code?: string
          criteria?: Json
          description?: string
          icon?: string | null
          sort_order?: number
          title?: string
          xp_reward?: number
        }
        Relationships: []
      }
      challenges: {
        Row: {
          created_at: string
          creator_id: string
          description: string | null
          ends_at: string
          id: string
          metric: string
          starts_at: string
          target_value: number
          title: string
        }
        Insert: {
          created_at?: string
          creator_id: string
          description?: string | null
          ends_at: string
          id?: string
          metric: string
          starts_at: string
          target_value: number
          title: string
        }
        Update: {
          created_at?: string
          creator_id?: string
          description?: string | null
          ends_at?: string
          id?: string
          metric?: string
          starts_at?: string
          target_value?: number
          title?: string
        }
        Relationships: []
      }
      friendships: {
        Row: {
          accepted_at: string | null
          addressee_id: string
          created_at: string
          id: string
          requester_id: string
          status: string
        }
        Insert: {
          accepted_at?: string | null
          addressee_id: string
          created_at?: string
          id?: string
          requester_id: string
          status?: string
        }
        Update: {
          accepted_at?: string | null
          addressee_id?: string
          created_at?: string
          id?: string
          requester_id?: string
          status?: string
        }
        Relationships: []
      }
      group_members: {
        Row: {
          group_id: string
          joined_at: string
          user_id: string
        }
        Insert: {
          group_id: string
          joined_at?: string
          user_id: string
        }
        Update: {
          group_id?: string
          joined_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "group_members_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
        ]
      }
      groups: {
        Row: {
          created_at: string
          description: string | null
          id: string
          name: string
          owner_id: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          name: string
          owner_id: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          owner_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          age: number | null
          available_days: number[] | null
          avatar_url: string | null
          created_at: string
          display_name: string | null
          experience_level: string | null
          friend_code: string | null
          gender: string | null
          height_cm: number | null
          id: string
          level: number
          main_goal: string | null
          onboarding_completed_at: string | null
          phone: string | null
          streak_current: number
          streak_last_date: string | null
          streak_longest: number
          updated_at: string
          username: string | null
          weight_kg: number | null
          xp_total: number
        }
        Insert: {
          age?: number | null
          available_days?: number[] | null
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          experience_level?: string | null
          friend_code?: string | null
          gender?: string | null
          height_cm?: number | null
          id: string
          level?: number
          main_goal?: string | null
          onboarding_completed_at?: string | null
          phone?: string | null
          streak_current?: number
          streak_last_date?: string | null
          streak_longest?: number
          updated_at?: string
          username?: string | null
          weight_kg?: number | null
          xp_total?: number
        }
        Update: {
          age?: number | null
          available_days?: number[] | null
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          experience_level?: string | null
          friend_code?: string | null
          gender?: string | null
          height_cm?: number | null
          id?: string
          level?: number
          main_goal?: string | null
          onboarding_completed_at?: string | null
          phone?: string | null
          streak_current?: number
          streak_last_date?: string | null
          streak_longest?: number
          updated_at?: string
          username?: string | null
          weight_kg?: number | null
          xp_total?: number
        }
        Relationships: []
      }
      run_sessions: {
        Row: {
          completed_at: string | null
          created_at: string
          distance_km: number | null
          duration_min: number | null
          id: string
          notes: string | null
          pace_seconds_per_km: number | null
          scheduled_date: string | null
          user_id: string
          week_number: number | null
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          distance_km?: number | null
          duration_min?: number | null
          id?: string
          notes?: string | null
          pace_seconds_per_km?: number | null
          scheduled_date?: string | null
          user_id: string
          week_number?: number | null
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          distance_km?: number | null
          duration_min?: number | null
          id?: string
          notes?: string | null
          pace_seconds_per_km?: number | null
          scheduled_date?: string | null
          user_id?: string
          week_number?: number | null
        }
        Relationships: []
      }
      user_achievements: {
        Row: {
          achievement_code: string
          unlocked_at: string
          user_id: string
        }
        Insert: {
          achievement_code: string
          unlocked_at?: string
          user_id: string
        }
        Update: {
          achievement_code?: string
          unlocked_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_achievements_achievement_code_fkey"
            columns: ["achievement_code"]
            isOneToOne: false
            referencedRelation: "achievements"
            referencedColumns: ["code"]
          },
        ]
      }
      week_plans: {
        Row: {
          created_at: string
          days_distribution: Json
          id: string
          user_id: string
          week_number: number
        }
        Insert: {
          created_at?: string
          days_distribution?: Json
          id?: string
          user_id: string
          week_number: number
        }
        Update: {
          created_at?: string
          days_distribution?: Json
          id?: string
          user_id?: string
          week_number?: number
        }
        Relationships: []
      }
      weight_history: {
        Row: {
          id: string
          recorded_at: string
          user_id: string
          weight_kg: number
        }
        Insert: {
          id?: string
          recorded_at?: string
          user_id: string
          weight_kg: number
        }
        Update: {
          id?: string
          recorded_at?: string
          user_id?: string
          weight_kg?: number
        }
        Relationships: []
      }
      workout_sessions: {
        Row: {
          completed_at: string | null
          created_at: string
          day_key: string
          duration_min: number | null
          id: string
          notes: string | null
          scheduled_date: string | null
          updated_at: string
          user_id: string
          week_number: number
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          day_key: string
          duration_min?: number | null
          id?: string
          notes?: string | null
          scheduled_date?: string | null
          updated_at?: string
          user_id: string
          week_number: number
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          day_key?: string
          duration_min?: number | null
          id?: string
          notes?: string | null
          scheduled_date?: string | null
          updated_at?: string
          user_id?: string
          week_number?: number
        }
        Relationships: []
      }
      xp_events: {
        Row: {
          created_at: string
          event_type: string
          id: string
          source_id: string | null
          user_id: string
          xp_amount: number
        }
        Insert: {
          created_at?: string
          event_type: string
          id?: string
          source_id?: string | null
          user_id: string
          xp_amount: number
        }
        Update: {
          created_at?: string
          event_type?: string
          id?: string
          source_id?: string | null
          user_id?: string
          xp_amount?: number
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      gen_friend_code: { Args: never; Returns: string }
    }
    Enums: {
      [_ in never]: never
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
    Enums: {},
  },
} as const
