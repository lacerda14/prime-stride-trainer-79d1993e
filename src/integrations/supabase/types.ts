export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
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
      ai_coaches: {
        Row: {
          avatar_url: string | null
          created_at: string
          description: string | null
          domain_slug: string | null
          emoji: string | null
          fallback_model: string
          id: string
          is_active: boolean
          is_premium: boolean
          knowledge_tags: string[]
          name: string
          persona: string
          preferred_model: string
          sort_order: number
          specialty: string
          system_prompt: string | null
          tone: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          description?: string | null
          domain_slug?: string | null
          emoji?: string | null
          fallback_model?: string
          id?: string
          is_active?: boolean
          is_premium?: boolean
          knowledge_tags?: string[]
          name: string
          persona: string
          preferred_model?: string
          sort_order?: number
          specialty: string
          system_prompt?: string | null
          tone: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          description?: string | null
          domain_slug?: string | null
          emoji?: string | null
          fallback_model?: string
          id?: string
          is_active?: boolean
          is_premium?: boolean
          knowledge_tags?: string[]
          name?: string
          persona?: string
          preferred_model?: string
          sort_order?: number
          specialty?: string
          system_prompt?: string | null
          tone?: string
        }
        Relationships: []
      }
      analytics_events: {
        Row: {
          event_name: string
          id: string
          occurred_at: string
          plan_at_event: string | null
          properties: Json
          user_id: string | null
        }
        Insert: {
          event_name: string
          id?: string
          occurred_at?: string
          plan_at_event?: string | null
          properties?: Json
          user_id?: string | null
        }
        Update: {
          event_name?: string
          id?: string
          occurred_at?: string
          plan_at_event?: string | null
          properties?: Json
          user_id?: string | null
        }
        Relationships: []
      }
      device_tokens: {
        Row: {
          created_at: string
          id: string
          last_seen_at: string
          platform: string
          token: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          last_seen_at?: string
          platform: string
          token: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          last_seen_at?: string
          platform?: string
          token?: string
          user_id?: string
        }
        Relationships: []
      }
      billing_product_map: {
        Row: {
          billing_period: string | null
          created_at: string
          is_active: boolean
          is_founder: boolean
          plan: string
          product_id: string
          provider: string
        }
        Insert: {
          billing_period?: string | null
          created_at?: string
          is_active?: boolean
          is_founder?: boolean
          plan: string
          product_id: string
          provider: string
        }
        Update: {
          billing_period?: string | null
          created_at?: string
          is_active?: boolean
          is_founder?: boolean
          plan?: string
          product_id?: string
          provider?: string
        }
        Relationships: []
      }
      billing_webhook_events: {
        Row: {
          event_id: string
          notification_type: string | null
          processed_at: string
          provider: string
          user_id: string | null
        }
        Insert: {
          event_id: string
          notification_type?: string | null
          processed_at?: string
          provider: string
          user_id?: string | null
        }
        Update: {
          event_id?: string
          notification_type?: string | null
          processed_at?: string
          provider?: string
          user_id?: string | null
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
      coach_domains: {
        Row: {
          avatar_url: string | null
          internal_coach_persona: string | null
          is_active: boolean
          name: string
          outcome_copy: string
          slug: string
          sort_order: number
        }
        Insert: {
          avatar_url?: string | null
          internal_coach_persona?: string | null
          is_active?: boolean
          name: string
          outcome_copy: string
          slug: string
          sort_order?: number
        }
        Update: {
          avatar_url?: string | null
          internal_coach_persona?: string | null
          is_active?: boolean
          name?: string
          outcome_copy?: string
          slug?: string
          sort_order?: number
        }
        Relationships: []
      }
      coach_session_refinements: {
        Row: {
          coach_persona: string
          created_at: string
          id: string
          input_tokens: number | null
          model: string | null
          output_tokens: number | null
          refinement: Json
          training_day_id: string
          user_id: string
        }
        Insert: {
          coach_persona: string
          created_at?: string
          id?: string
          input_tokens?: number | null
          model?: string | null
          output_tokens?: number | null
          refinement: Json
          training_day_id: string
          user_id: string
        }
        Update: {
          coach_persona?: string
          created_at?: string
          id?: string
          input_tokens?: number | null
          model?: string | null
          output_tokens?: number | null
          refinement?: Json
          training_day_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "coach_session_refinements_training_day_id_fkey"
            columns: ["training_day_id"]
            isOneToOne: false
            referencedRelation: "training_days"
            referencedColumns: ["id"]
          },
        ]
      }
      daily_health_metrics: {
        Row: {
          active_energy_kcal: number | null
          avg_hr_day: number | null
          body_weight_kg: number | null
          created_at: string
          date: string
          exercise_minutes: number | null
          hrv_rmssd: number | null
          id: string
          max_hr_day: number | null
          platform: string | null
          raw_payload: Json | null
          recovery_score_source: number | null
          respiratory_rate: number | null
          resting_hr: number | null
          skin_temp_delta_c: number | null
          sleep_deep_min: number | null
          sleep_duration_min: number | null
          sleep_end: string | null
          sleep_quality_score: number | null
          sleep_rem_min: number | null
          sleep_start: string | null
          spo2_pct: number | null
          stand_hours: number | null
          steps: number | null
          updated_at: string
          user_id: string
          vo2_max_estimate: number | null
        }
        Insert: {
          active_energy_kcal?: number | null
          avg_hr_day?: number | null
          body_weight_kg?: number | null
          created_at?: string
          date: string
          exercise_minutes?: number | null
          hrv_rmssd?: number | null
          id?: string
          max_hr_day?: number | null
          platform?: string | null
          raw_payload?: Json | null
          recovery_score_source?: number | null
          respiratory_rate?: number | null
          resting_hr?: number | null
          skin_temp_delta_c?: number | null
          sleep_deep_min?: number | null
          sleep_duration_min?: number | null
          sleep_end?: string | null
          sleep_quality_score?: number | null
          sleep_rem_min?: number | null
          sleep_start?: string | null
          spo2_pct?: number | null
          stand_hours?: number | null
          steps?: number | null
          updated_at?: string
          user_id: string
          vo2_max_estimate?: number | null
        }
        Update: {
          active_energy_kcal?: number | null
          avg_hr_day?: number | null
          body_weight_kg?: number | null
          created_at?: string
          date?: string
          exercise_minutes?: number | null
          hrv_rmssd?: number | null
          id?: string
          max_hr_day?: number | null
          platform?: string | null
          raw_payload?: Json | null
          recovery_score_source?: number | null
          respiratory_rate?: number | null
          resting_hr?: number | null
          skin_temp_delta_c?: number | null
          sleep_deep_min?: number | null
          sleep_duration_min?: number | null
          sleep_end?: string | null
          sleep_quality_score?: number | null
          sleep_rem_min?: number | null
          sleep_start?: string | null
          spo2_pct?: number | null
          stand_hours?: number | null
          steps?: number | null
          updated_at?: string
          user_id?: string
          vo2_max_estimate?: number | null
        }
        Relationships: []
      }
      exercise_media: {
        Row: {
          channel_name: string | null
          created_at: string
          created_by_agent: boolean
          duration_seconds: number | null
          embed_allowed: boolean
          embed_url: string | null
          exercise_id: string
          external_id: string | null
          id: string
          instructor_name: string | null
          is_approved: boolean
          is_primary: boolean
          media_type: Database["public"]["Enums"]["exercise_media_type"]
          reason_for_recommendation: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          safety_notes: string | null
          source: string | null
          source_quality_score: number | null
          storage_path: string | null
          thumbnail_url: string | null
          title: string | null
          updated_at: string
          url: string | null
        }
        Insert: {
          channel_name?: string | null
          created_at?: string
          created_by_agent?: boolean
          duration_seconds?: number | null
          embed_allowed?: boolean
          embed_url?: string | null
          exercise_id: string
          external_id?: string | null
          id?: string
          instructor_name?: string | null
          is_approved?: boolean
          is_primary?: boolean
          media_type: Database["public"]["Enums"]["exercise_media_type"]
          reason_for_recommendation?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          safety_notes?: string | null
          source?: string | null
          source_quality_score?: number | null
          storage_path?: string | null
          thumbnail_url?: string | null
          title?: string | null
          updated_at?: string
          url?: string | null
        }
        Update: {
          channel_name?: string | null
          created_at?: string
          created_by_agent?: boolean
          duration_seconds?: number | null
          embed_allowed?: boolean
          embed_url?: string | null
          exercise_id?: string
          external_id?: string | null
          id?: string
          instructor_name?: string | null
          is_approved?: boolean
          is_primary?: boolean
          media_type?: Database["public"]["Enums"]["exercise_media_type"]
          reason_for_recommendation?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          safety_notes?: string | null
          source?: string | null
          source_quality_score?: number | null
          storage_path?: string | null
          thumbnail_url?: string | null
          title?: string | null
          updated_at?: string
          url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "exercise_media_exercise_id_fkey"
            columns: ["exercise_id"]
            isOneToOne: false
            referencedRelation: "exercise_pool"
            referencedColumns: ["id"]
          },
        ]
      }
      exercise_pool: {
        Row: {
          allowed_advanced: boolean
          allowed_beginner: boolean
          allowed_intermediate: boolean
          banned_weeks_1_to_12: boolean
          category: Database["public"]["Enums"]["exercise_category_enum"]
          code: string
          common_mistakes: string | null
          created_at: string
          equipment: string | null
          gif_url: string | null
          id: string
          instructions: string | null
          lower_body_pattern: string | null
          metric_type: string
          movement_pattern: string | null
          name: string
          notes: string | null
          primary_muscles: string[]
          shoulder_safe: boolean
          video_url: string | null
        }
        Insert: {
          allowed_advanced?: boolean
          allowed_beginner?: boolean
          allowed_intermediate?: boolean
          banned_weeks_1_to_12?: boolean
          category: Database["public"]["Enums"]["exercise_category_enum"]
          code: string
          common_mistakes?: string | null
          created_at?: string
          equipment?: string | null
          gif_url?: string | null
          id?: string
          instructions?: string | null
          lower_body_pattern?: string | null
          metric_type?: string
          movement_pattern?: string | null
          name: string
          notes?: string | null
          primary_muscles?: string[]
          shoulder_safe?: boolean
          video_url?: string | null
        }
        Update: {
          allowed_advanced?: boolean
          allowed_beginner?: boolean
          allowed_intermediate?: boolean
          banned_weeks_1_to_12?: boolean
          category?: Database["public"]["Enums"]["exercise_category_enum"]
          code?: string
          common_mistakes?: string | null
          created_at?: string
          equipment?: string | null
          gif_url?: string | null
          id?: string
          instructions?: string | null
          lower_body_pattern?: string | null
          metric_type?: string
          movement_pattern?: string | null
          name?: string
          notes?: string | null
          primary_muscles?: string[]
          shoulder_safe?: boolean
          video_url?: string | null
        }
        Relationships: []
      }
      feature_flags: {
        Row: {
          created_at: string
          is_active: boolean
          is_trial_eligible: boolean
          key: string
          name: string
          required_plan: string
        }
        Insert: {
          created_at?: string
          is_active?: boolean
          is_trial_eligible?: boolean
          key: string
          name: string
          required_plan?: string
        }
        Update: {
          created_at?: string
          is_active?: boolean
          is_trial_eligible?: boolean
          key?: string
          name?: string
          required_plan?: string
        }
        Relationships: []
      }
      feed_comments: {
        Row: {
          body: string
          created_at: string
          id: string
          post_id: string
          user_id: string
        }
        Insert: {
          body: string
          created_at?: string
          id?: string
          post_id: string
          user_id: string
        }
        Update: {
          body?: string
          created_at?: string
          id?: string
          post_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "feed_comments_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "feed_posts"
            referencedColumns: ["id"]
          },
        ]
      }
      feed_posts: {
        Row: {
          caption: string | null
          created_at: string
          id: string
          kind: string
          photo_path: string | null
          user_id: string
          workout_session_id: string | null
        }
        Insert: {
          caption?: string | null
          created_at?: string
          id?: string
          kind?: string
          photo_path?: string | null
          user_id: string
          workout_session_id?: string | null
        }
        Update: {
          caption?: string | null
          created_at?: string
          id?: string
          kind?: string
          photo_path?: string | null
          user_id?: string
          workout_session_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "feed_posts_workout_session_id_fkey"
            columns: ["workout_session_id"]
            isOneToOne: false
            referencedRelation: "workout_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      feed_reactions: {
        Row: {
          created_at: string
          emoji: string
          id: string
          post_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          emoji?: string
          id?: string
          post_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          emoji?: string
          id?: string
          post_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "feed_reactions_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "feed_posts"
            referencedColumns: ["id"]
          },
        ]
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
      garmin_connections: {
        Row: {
          access_token: string
          connected_at: string
          garmin_user_id: string | null
          refresh_token: string | null
          scope: string | null
          token_expires_at: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          access_token: string
          connected_at?: string
          garmin_user_id?: string | null
          refresh_token?: string | null
          scope?: string | null
          token_expires_at?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          access_token?: string
          connected_at?: string
          garmin_user_id?: string | null
          refresh_token?: string | null
          scope?: string | null
          token_expires_at?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      garmin_oauth_states: {
        Row: {
          code_verifier: string
          created_at: string
          redirect_to: string | null
          state: string
          user_id: string
        }
        Insert: {
          code_verifier: string
          created_at?: string
          redirect_to?: string | null
          state: string
          user_id: string
        }
        Update: {
          code_verifier?: string
          created_at?: string
          redirect_to?: string | null
          state?: string
          user_id?: string
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
      health_integrations: {
        Row: {
          access_token: string | null
          created_at: string
          id: string
          is_active: boolean
          last_sync_at: string | null
          platform: Database["public"]["Enums"]["wearable_platform"]
          refresh_token: string | null
          scopes: string[]
          token_expires_at: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          access_token?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          last_sync_at?: string | null
          platform: Database["public"]["Enums"]["wearable_platform"]
          refresh_token?: string | null
          scopes?: string[]
          token_expires_at?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          access_token?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          last_sync_at?: string | null
          platform?: Database["public"]["Enums"]["wearable_platform"]
          refresh_token?: string | null
          scopes?: string[]
          token_expires_at?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      heart_rate_samples: {
        Row: {
          bpm: number
          id: string
          sampled_at: string
          session_id: string | null
          source: string | null
          user_id: string
        }
        Insert: {
          bpm: number
          id?: string
          sampled_at: string
          session_id?: string | null
          source?: string | null
          user_id: string
        }
        Update: {
          bpm?: number
          id?: string
          sampled_at?: string
          session_id?: string | null
          source?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "heart_rate_samples_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "workout_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      knowledge_chunks: {
        Row: {
          chunk_index: number
          content: string
          created_at: string
          document_id: string
          embedding: string | null
          embedding_model: string
          id: string
          metadata: Json
          token_count: number | null
        }
        Insert: {
          chunk_index: number
          content: string
          created_at?: string
          document_id: string
          embedding?: string | null
          embedding_model?: string
          id?: string
          metadata?: Json
          token_count?: number | null
        }
        Update: {
          chunk_index?: number
          content?: string
          created_at?: string
          document_id?: string
          embedding?: string | null
          embedding_model?: string
          id?: string
          metadata?: Json
          token_count?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "knowledge_chunks_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "knowledge_documents"
            referencedColumns: ["id"]
          },
        ]
      }
      knowledge_documents: {
        Row: {
          author: string | null
          auto_tagged: boolean
          chunk_count: number
          content: string
          created_at: string
          id: string
          is_active: boolean
          language: string
          source_type: string
          source_url: string | null
          tags: string[]
          title: string
          updated_at: string
        }
        Insert: {
          author?: string | null
          auto_tagged?: boolean
          chunk_count?: number
          content: string
          created_at?: string
          id?: string
          is_active?: boolean
          language?: string
          source_type?: string
          source_url?: string | null
          tags?: string[]
          title: string
          updated_at?: string
        }
        Update: {
          author?: string | null
          auto_tagged?: boolean
          chunk_count?: number
          content?: string
          created_at?: string
          id?: string
          is_active?: boolean
          language?: string
          source_type?: string
          source_url?: string | null
          tags?: string[]
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      macrocycles: {
        Row: {
          created_at: string
          dominant_method: string | null
          end_week: number
          id: string
          name: string
          objective: string | null
          program_id: string
          sort_order: number
          start_week: number
        }
        Insert: {
          created_at?: string
          dominant_method?: string | null
          end_week: number
          id?: string
          name: string
          objective?: string | null
          program_id: string
          sort_order: number
          start_week: number
        }
        Update: {
          created_at?: string
          dominant_method?: string | null
          end_week?: number
          id?: string
          name?: string
          objective?: string | null
          program_id?: string
          sort_order?: number
          start_week?: number
        }
        Relationships: [
          {
            foreignKeyName: "macrocycles_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "training_programs"
            referencedColumns: ["id"]
          },
        ]
      }
      mesocycles: {
        Row: {
          created_at: string
          end_week: number
          id: string
          macrocycle_id: string
          method: string | null
          name: string
          objective: string | null
          sort_order: number
          start_week: number
        }
        Insert: {
          created_at?: string
          end_week: number
          id?: string
          macrocycle_id: string
          method?: string | null
          name: string
          objective?: string | null
          sort_order: number
          start_week: number
        }
        Update: {
          created_at?: string
          end_week?: number
          id?: string
          macrocycle_id?: string
          method?: string | null
          name?: string
          objective?: string | null
          sort_order?: number
          start_week?: number
        }
        Relationships: [
          {
            foreignKeyName: "mesocycles_macrocycle_id_fkey"
            columns: ["macrocycle_id"]
            isOneToOne: false
            referencedRelation: "macrocycles"
            referencedColumns: ["id"]
          },
        ]
      }
      personal_records: {
        Row: {
          achieved_at: string
          category: string
          created_at: string
          estimated_1rm: number | null
          exercise_code: string
          id: string
          metric_type: string
          previous_value: number | null
          secondary_value: number | null
          source_session_id: string | null
          updated_at: string
          user_id: string
          value: number
        }
        Insert: {
          achieved_at?: string
          category: string
          created_at?: string
          estimated_1rm?: number | null
          exercise_code: string
          id?: string
          metric_type: string
          previous_value?: number | null
          secondary_value?: number | null
          source_session_id?: string | null
          updated_at?: string
          user_id: string
          value: number
        }
        Update: {
          achieved_at?: string
          category?: string
          created_at?: string
          estimated_1rm?: number | null
          exercise_code?: string
          id?: string
          metric_type?: string
          previous_value?: number | null
          secondary_value?: number | null
          source_session_id?: string | null
          updated_at?: string
          user_id?: string
          value?: number
        }
        Relationships: []
      }
      plan_domain_access: {
        Row: {
          domain_slug: string
          plan: string
        }
        Insert: {
          domain_slug: string
          plan: string
        }
        Update: {
          domain_slug?: string
          plan?: string
        }
        Relationships: [
          {
            foreignKeyName: "plan_domain_access_domain_slug_fkey"
            columns: ["domain_slug"]
            isOneToOne: false
            referencedRelation: "coach_domains"
            referencedColumns: ["slug"]
          },
        ]
      }
      plans: {
        Row: {
          ai_requests_daily: number
          created_at: string
          features: string[]
          id: string
          is_active: boolean
          name: string
          price_brl: number
        }
        Insert: {
          ai_requests_daily?: number
          created_at?: string
          features?: string[]
          id: string
          is_active?: boolean
          name: string
          price_brl?: number
        }
        Update: {
          ai_requests_daily?: number
          created_at?: string
          features?: string[]
          id?: string
          is_active?: boolean
          name?: string
          price_brl?: number
        }
        Relationships: []
      }
      pr_history: {
        Row: {
          achieved_at: string
          category: string
          created_at: string
          estimated_1rm: number | null
          exercise_code: string
          id: string
          improvement_pct: number | null
          metric_type: string
          previous_value: number | null
          secondary_value: number | null
          source_session_id: string | null
          user_id: string
          value: number
        }
        Insert: {
          achieved_at?: string
          category: string
          created_at?: string
          estimated_1rm?: number | null
          exercise_code: string
          id?: string
          improvement_pct?: number | null
          metric_type: string
          previous_value?: number | null
          secondary_value?: number | null
          source_session_id?: string | null
          user_id: string
          value: number
        }
        Update: {
          achieved_at?: string
          category?: string
          created_at?: string
          estimated_1rm?: number | null
          exercise_code?: string
          id?: string
          improvement_pct?: number | null
          metric_type?: string
          previous_value?: number | null
          secondary_value?: number | null
          source_session_id?: string | null
          user_id?: string
          value?: number
        }
        Relationships: []
      }
      profiles: {
        Row: {
          age: number | null
          alcohol_frequency: string | null
          arm_cm: number | null
          available_days: number | null
          available_days_list: string[]
          available_minutes: number | null
          avatar_url: string | null
          birth_date: string | null
          cardio_preference: string | null
          chest_cm: number | null
          created_at: string
          current_pain_level: number | null
          current_plan: Database["public"]["Enums"]["subscription_plan"]
          current_week: number
          emergency_contact_name: string | null
          emergency_contact_phone: string | null
          equipment: string[]
          experience_level:
            | Database["public"]["Enums"]["experience_level_enum"]
            | null
          first_name: string | null
          friend_code: string | null
          goal: Database["public"]["Enums"]["goal_enum"] | null
          gym_setup: Json
          had_structured_program: string | null
          had_surgery: string | null
          height_cm: number | null
          hip_cm: number | null
          id: string
          last_medical_checkup: string | null
          last_name: string | null
          level: number
          limitations_notes: string | null
          max_heart_rate_override: number | null
          medical_conditions: string[]
          medical_restrictions: string | null
          medications: string | null
          motivations: string[]
          name: string | null
          onboarding_completed: boolean
          onboarding_step: number | null
          pain_intensity: Json | null
          pain_regions: string[]
          past_injuries: string[]
          perf_lifts_done: string[]
          perf_longest_run_km: number | null
          perf_max_plank_seconds: number | null
          perf_max_pushups: number | null
          perf_max_run_minutes: number | null
          perf_max_squats: number | null
          phone: string | null
          preferences: string[]
          preferred_time: string | null
          preferred_wearable_platform:
            | Database["public"]["Enums"]["wearable_platform"]
            | null
          primary_goal: string | null
          professional_activity: string | null
          program_start_date: string
          running_continuous_minutes: string | null
          running_goals: string[]
          running_level: string | null
          running_mode: string | null
          running_preferred_days: string[]
          secondary_goals: string[]
          sex: Database["public"]["Enums"]["sex_enum"] | null
          show_ads: boolean
          sleep_hours: number | null
          smokes: boolean | null
          sports: string[]
          sports_frequency: Json
          sports_frequency_week: number | null
          sports_notes: string | null
          notification_prefs: Json
          streak_current: number
          streak_last_date: string | null
          streak_longest: number
          surgeries: Json
          thigh_cm: number | null
          training_history: string | null
          training_location: string | null
          training_style: string | null
          training_years: string | null
          uncomfortable_movements: string[]
          updated_at: string
          username: string | null
          waist_cm: number | null
          water_intake: string | null
          weight_kg: number | null
          xp_total: number
        }
        Insert: {
          age?: number | null
          alcohol_frequency?: string | null
          arm_cm?: number | null
          available_days?: number | null
          available_days_list?: string[]
          available_minutes?: number | null
          avatar_url?: string | null
          birth_date?: string | null
          cardio_preference?: string | null
          chest_cm?: number | null
          created_at?: string
          current_pain_level?: number | null
          current_plan?: Database["public"]["Enums"]["subscription_plan"]
          current_week?: number
          emergency_contact_name?: string | null
          emergency_contact_phone?: string | null
          equipment?: string[]
          experience_level?:
            | Database["public"]["Enums"]["experience_level_enum"]
            | null
          first_name?: string | null
          friend_code?: string | null
          goal?: Database["public"]["Enums"]["goal_enum"] | null
          gym_setup?: Json
          had_structured_program?: string | null
          had_surgery?: string | null
          height_cm?: number | null
          hip_cm?: number | null
          id: string
          last_medical_checkup?: string | null
          last_name?: string | null
          level?: number
          limitations_notes?: string | null
          max_heart_rate_override?: number | null
          medical_conditions?: string[]
          medical_restrictions?: string | null
          medications?: string | null
          motivations?: string[]
          name?: string | null
          onboarding_completed?: boolean
          onboarding_step?: number | null
          pain_intensity?: Json | null
          pain_regions?: string[]
          past_injuries?: string[]
          perf_lifts_done?: string[]
          perf_longest_run_km?: number | null
          perf_max_plank_seconds?: number | null
          perf_max_pushups?: number | null
          perf_max_run_minutes?: number | null
          perf_max_squats?: number | null
          phone?: string | null
          preferences?: string[]
          preferred_time?: string | null
          preferred_wearable_platform?:
            | Database["public"]["Enums"]["wearable_platform"]
            | null
          primary_goal?: string | null
          professional_activity?: string | null
          program_start_date?: string
          running_continuous_minutes?: string | null
          running_goals?: string[]
          running_level?: string | null
          running_mode?: string | null
          running_preferred_days?: string[]
          secondary_goals?: string[]
          sex?: Database["public"]["Enums"]["sex_enum"] | null
          show_ads?: boolean
          sleep_hours?: number | null
          smokes?: boolean | null
          sports?: string[]
          sports_frequency?: Json
          sports_frequency_week?: number | null
          sports_notes?: string | null
          notification_prefs?: Json
          streak_current?: number
          streak_last_date?: string | null
          streak_longest?: number
          surgeries?: Json
          thigh_cm?: number | null
          training_history?: string | null
          training_location?: string | null
          training_style?: string | null
          training_years?: string | null
          uncomfortable_movements?: string[]
          updated_at?: string
          username?: string | null
          waist_cm?: number | null
          water_intake?: string | null
          weight_kg?: number | null
          xp_total?: number
        }
        Update: {
          age?: number | null
          alcohol_frequency?: string | null
          arm_cm?: number | null
          available_days?: number | null
          available_days_list?: string[]
          available_minutes?: number | null
          avatar_url?: string | null
          birth_date?: string | null
          cardio_preference?: string | null
          chest_cm?: number | null
          created_at?: string
          current_pain_level?: number | null
          current_plan?: Database["public"]["Enums"]["subscription_plan"]
          current_week?: number
          emergency_contact_name?: string | null
          emergency_contact_phone?: string | null
          equipment?: string[]
          experience_level?:
            | Database["public"]["Enums"]["experience_level_enum"]
            | null
          first_name?: string | null
          friend_code?: string | null
          goal?: Database["public"]["Enums"]["goal_enum"] | null
          gym_setup?: Json
          had_structured_program?: string | null
          had_surgery?: string | null
          height_cm?: number | null
          hip_cm?: number | null
          id?: string
          last_medical_checkup?: string | null
          last_name?: string | null
          level?: number
          limitations_notes?: string | null
          max_heart_rate_override?: number | null
          medical_conditions?: string[]
          medical_restrictions?: string | null
          medications?: string | null
          motivations?: string[]
          name?: string | null
          onboarding_completed?: boolean
          onboarding_step?: number | null
          pain_intensity?: Json | null
          pain_regions?: string[]
          past_injuries?: string[]
          perf_lifts_done?: string[]
          perf_longest_run_km?: number | null
          perf_max_plank_seconds?: number | null
          perf_max_pushups?: number | null
          perf_max_run_minutes?: number | null
          perf_max_squats?: number | null
          phone?: string | null
          preferences?: string[]
          preferred_time?: string | null
          preferred_wearable_platform?:
            | Database["public"]["Enums"]["wearable_platform"]
            | null
          primary_goal?: string | null
          professional_activity?: string | null
          program_start_date?: string
          running_continuous_minutes?: string | null
          running_goals?: string[]
          running_level?: string | null
          running_mode?: string | null
          running_preferred_days?: string[]
          secondary_goals?: string[]
          sex?: Database["public"]["Enums"]["sex_enum"] | null
          show_ads?: boolean
          sleep_hours?: number | null
          smokes?: boolean | null
          sports?: string[]
          sports_frequency?: Json
          sports_frequency_week?: number | null
          sports_notes?: string | null
          notification_prefs?: Json
          streak_current?: number
          streak_last_date?: string | null
          streak_longest?: number
          surgeries?: Json
          thigh_cm?: number | null
          training_history?: string | null
          training_location?: string | null
          training_style?: string | null
          training_years?: string | null
          uncomfortable_movements?: string[]
          updated_at?: string
          username?: string | null
          waist_cm?: number | null
          water_intake?: string | null
          weight_kg?: number | null
          xp_total?: number
        }
        Relationships: []
      }
      progress_photos: {
        Row: {
          id: string
          photo_type: string
          storage_path: string
          uploaded_at: string
          user_id: string
        }
        Insert: {
          id?: string
          photo_type: string
          storage_path: string
          uploaded_at?: string
          user_id: string
        }
        Update: {
          id?: string
          photo_type?: string
          storage_path?: string
          uploaded_at?: string
          user_id?: string
        }
        Relationships: []
      }
      readiness_scores: {
        Row: {
          created_at: string
          decision: Json
          id: string
          score: number
          session_id: string | null
          signals: Json
          user_id: string
        }
        Insert: {
          created_at?: string
          decision?: Json
          id?: string
          score: number
          session_id?: string | null
          signals?: Json
          user_id: string
        }
        Update: {
          created_at?: string
          decision?: Json
          id?: string
          score?: number
          session_id?: string | null
          signals?: Json
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "readiness_scores_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "workout_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      recovery_signals: {
        Row: {
          acwr: number | null
          ai_summary: string | null
          calculated_at: string
          created_at: string
          fatigue_score: number | null
          id: string
          readiness_score: number | null
          recommended_intensity: Database["public"]["Enums"]["recommended_intensity"]
          recovery_score: number | null
          training_load_28d: number | null
          training_load_7d: number | null
          user_id: string
        }
        Insert: {
          acwr?: number | null
          ai_summary?: string | null
          calculated_at?: string
          created_at?: string
          fatigue_score?: number | null
          id?: string
          readiness_score?: number | null
          recommended_intensity?: Database["public"]["Enums"]["recommended_intensity"]
          recovery_score?: number | null
          training_load_28d?: number | null
          training_load_7d?: number | null
          user_id: string
        }
        Update: {
          acwr?: number | null
          ai_summary?: string | null
          calculated_at?: string
          created_at?: string
          fatigue_score?: number | null
          id?: string
          readiness_score?: number | null
          recommended_intensity?: Database["public"]["Enums"]["recommended_intensity"]
          recovery_score?: number | null
          training_load_28d?: number | null
          training_load_7d?: number | null
          user_id?: string
        }
        Relationships: []
      }
      run_sessions: {
        Row: {
          cadence: number | null
          calories: number | null
          completed_at: string | null
          created_at: string
          distance_km: number | null
          duration_min: number | null
          heart_rate_avg: number | null
          heart_rate_max: number | null
          id: string
          notes: string | null
          pace_real_seconds_per_km: number | null
          pace_seconds_per_km: number | null
          scheduled_date: string | null
          user_id: string
          week_number: number | null
          zone: string | null
        }
        Insert: {
          cadence?: number | null
          calories?: number | null
          completed_at?: string | null
          created_at?: string
          distance_km?: number | null
          duration_min?: number | null
          heart_rate_avg?: number | null
          heart_rate_max?: number | null
          id?: string
          notes?: string | null
          pace_real_seconds_per_km?: number | null
          pace_seconds_per_km?: number | null
          scheduled_date?: string | null
          user_id: string
          week_number?: number | null
          zone?: string | null
        }
        Update: {
          cadence?: number | null
          calories?: number | null
          completed_at?: string | null
          created_at?: string
          distance_km?: number | null
          duration_min?: number | null
          heart_rate_avg?: number | null
          heart_rate_max?: number | null
          id?: string
          notes?: string | null
          pace_real_seconds_per_km?: number | null
          pace_seconds_per_km?: number | null
          scheduled_date?: string | null
          user_id?: string
          week_number?: number | null
          zone?: string | null
        }
        Relationships: []
      }
      running_protocols: {
        Row: {
          between_blocks_rest_seconds: number | null
          blocks: number | null
          cooldown_minutes: number | null
          created_at: string
          goal: string | null
          id: string
          intervals: number | null
          intervals_per_block: number | null
          notes: string | null
          pace_max: number | null
          pace_min: number | null
          protocol_name: string | null
          protocol_type: Database["public"]["Enums"]["running_protocol_enum"]
          rest_duration_seconds: number | null
          target_pace_max: number | null
          target_pace_min: number | null
          total_duration_minutes: number | null
          training_day_id: string
          warmup_minutes: number | null
          work_duration_seconds: number | null
        }
        Insert: {
          between_blocks_rest_seconds?: number | null
          blocks?: number | null
          cooldown_minutes?: number | null
          created_at?: string
          goal?: string | null
          id?: string
          intervals?: number | null
          intervals_per_block?: number | null
          notes?: string | null
          pace_max?: number | null
          pace_min?: number | null
          protocol_name?: string | null
          protocol_type: Database["public"]["Enums"]["running_protocol_enum"]
          rest_duration_seconds?: number | null
          target_pace_max?: number | null
          target_pace_min?: number | null
          total_duration_minutes?: number | null
          training_day_id: string
          warmup_minutes?: number | null
          work_duration_seconds?: number | null
        }
        Update: {
          between_blocks_rest_seconds?: number | null
          blocks?: number | null
          cooldown_minutes?: number | null
          created_at?: string
          goal?: string | null
          id?: string
          intervals?: number | null
          intervals_per_block?: number | null
          notes?: string | null
          pace_max?: number | null
          pace_min?: number | null
          protocol_name?: string | null
          protocol_type?: Database["public"]["Enums"]["running_protocol_enum"]
          rest_duration_seconds?: number | null
          target_pace_max?: number | null
          target_pace_min?: number | null
          total_duration_minutes?: number | null
          training_day_id?: string
          warmup_minutes?: number | null
          work_duration_seconds?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "running_protocols_training_day_id_fkey"
            columns: ["training_day_id"]
            isOneToOne: false
            referencedRelation: "training_days"
            referencedColumns: ["id"]
          },
        ]
      }
      running_session_logs: {
        Row: {
          average_pace: string | null
          average_speed_kmh: number | null
          created_at: string
          distance_km: number | null
          id: string
          max_speed_kmh: number | null
          notes: string | null
          perceived_effort: number | null
          planned_protocol_id: string | null
          total_duration_seconds: number | null
          total_rest_seconds: number | null
          total_running_seconds: number | null
          updated_at: string
          user_id: string
          workout_session_id: string
        }
        Insert: {
          average_pace?: string | null
          average_speed_kmh?: number | null
          created_at?: string
          distance_km?: number | null
          id?: string
          max_speed_kmh?: number | null
          notes?: string | null
          perceived_effort?: number | null
          planned_protocol_id?: string | null
          total_duration_seconds?: number | null
          total_rest_seconds?: number | null
          total_running_seconds?: number | null
          updated_at?: string
          user_id: string
          workout_session_id: string
        }
        Update: {
          average_pace?: string | null
          average_speed_kmh?: number | null
          created_at?: string
          distance_km?: number | null
          id?: string
          max_speed_kmh?: number | null
          notes?: string | null
          perceived_effort?: number | null
          planned_protocol_id?: string | null
          total_duration_seconds?: number | null
          total_rest_seconds?: number | null
          total_running_seconds?: number | null
          updated_at?: string
          user_id?: string
          workout_session_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "running_session_logs_workout_session_id_fkey"
            columns: ["workout_session_id"]
            isOneToOne: true
            referencedRelation: "workout_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      session_exercises: {
        Row: {
          created_at: string
          exercise_id: string
          id: string
          notes: string | null
          pair_slot: number | null
          pr_at: string | null
          reps: string
          rest_seconds: number | null
          rpe_target: number | null
          sets: number
          slot: number
          training_day_id: string
        }
        Insert: {
          created_at?: string
          exercise_id: string
          id?: string
          notes?: string | null
          pair_slot?: number | null
          pr_at?: string | null
          reps: string
          rest_seconds?: number | null
          rpe_target?: number | null
          sets: number
          slot: number
          training_day_id: string
        }
        Update: {
          created_at?: string
          exercise_id?: string
          id?: string
          notes?: string | null
          pair_slot?: number | null
          pr_at?: string | null
          reps?: string
          rest_seconds?: number | null
          rpe_target?: number | null
          sets?: number
          slot?: number
          training_day_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "session_exercises_exercise_id_fkey"
            columns: ["exercise_id"]
            isOneToOne: false
            referencedRelation: "exercise_pool"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "session_exercises_training_day_id_fkey"
            columns: ["training_day_id"]
            isOneToOne: false
            referencedRelation: "training_days"
            referencedColumns: ["id"]
          },
        ]
      }
      set_timing_logs: {
        Row: {
          completed_at: string | null
          created_at: string
          duration_seconds: number | null
          expected_duration_seconds: number | null
          hr_avg_during_set: number | null
          id: string
          load_delta_suggested_kg: number | null
          load_signal: Database["public"]["Enums"]["load_signal"]
          rpe_reported: number | null
          session_id: string | null
          set_log_id: string | null
          started_at: string
          time_under_tension_est: number | null
          user_id: string
          velocity_category:
            | Database["public"]["Enums"]["velocity_category"]
            | null
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          duration_seconds?: number | null
          expected_duration_seconds?: number | null
          hr_avg_during_set?: number | null
          id?: string
          load_delta_suggested_kg?: number | null
          load_signal?: Database["public"]["Enums"]["load_signal"]
          rpe_reported?: number | null
          session_id?: string | null
          set_log_id?: string | null
          started_at: string
          time_under_tension_est?: number | null
          user_id: string
          velocity_category?:
            | Database["public"]["Enums"]["velocity_category"]
            | null
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          duration_seconds?: number | null
          expected_duration_seconds?: number | null
          hr_avg_during_set?: number | null
          id?: string
          load_delta_suggested_kg?: number | null
          load_signal?: Database["public"]["Enums"]["load_signal"]
          rpe_reported?: number | null
          session_id?: string | null
          set_log_id?: string | null
          started_at?: string
          time_under_tension_est?: number | null
          user_id?: string
          velocity_category?:
            | Database["public"]["Enums"]["velocity_category"]
            | null
        }
        Relationships: [
          {
            foreignKeyName: "set_timing_logs_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "workout_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "set_timing_logs_set_log_id_fkey"
            columns: ["set_log_id"]
            isOneToOne: false
            referencedRelation: "workout_set_logs"
            referencedColumns: ["id"]
          },
        ]
      }
      subscriptions: {
        Row: {
          active_features: string[]
          ai_requests_reset_at: string
          ai_requests_today: number
          billing_status: Database["public"]["Enums"]["billing_status_type"]
          cancelled_at: string | null
          created_at: string
          current_period_end: string | null
          current_period_start: string | null
          expires_at: string | null
          external_customer_id: string | null
          external_subscription_id: string | null
          id: string
          is_founder: boolean
          payment_provider: string | null
          plan: Database["public"]["Enums"]["subscription_plan"]
          show_ads: boolean
          started_at: string
          trial_ends_at: string | null
          trial_started_at: string | null
          trial_used: boolean
          updated_at: string
          user_id: string
        }
        Insert: {
          active_features?: string[]
          ai_requests_reset_at?: string
          ai_requests_today?: number
          billing_status?: Database["public"]["Enums"]["billing_status_type"]
          cancelled_at?: string | null
          created_at?: string
          current_period_end?: string | null
          current_period_start?: string | null
          expires_at?: string | null
          external_customer_id?: string | null
          external_subscription_id?: string | null
          id?: string
          is_founder?: boolean
          payment_provider?: string | null
          plan?: Database["public"]["Enums"]["subscription_plan"]
          show_ads?: boolean
          started_at?: string
          trial_ends_at?: string | null
          trial_started_at?: string | null
          trial_used?: boolean
          updated_at?: string
          user_id: string
        }
        Update: {
          active_features?: string[]
          ai_requests_reset_at?: string
          ai_requests_today?: number
          billing_status?: Database["public"]["Enums"]["billing_status_type"]
          cancelled_at?: string | null
          created_at?: string
          current_period_end?: string | null
          current_period_start?: string | null
          expires_at?: string | null
          external_customer_id?: string | null
          external_subscription_id?: string | null
          id?: string
          is_founder?: boolean
          payment_provider?: string | null
          plan?: Database["public"]["Enums"]["subscription_plan"]
          show_ads?: boolean
          started_at?: string
          trial_ends_at?: string | null
          trial_started_at?: string | null
          trial_used?: boolean
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      subscriptions_backup_pre_tiers: {
        Row: {
          active_features: string[] | null
          ai_requests_reset_at: string | null
          ai_requests_today: number | null
          backed_up_at: string | null
          billing_status:
            | Database["public"]["Enums"]["billing_status_type"]
            | null
          cancelled_at: string | null
          created_at: string | null
          current_period_end: string | null
          current_period_start: string | null
          expires_at: string | null
          external_customer_id: string | null
          external_subscription_id: string | null
          id: string | null
          is_founder: boolean | null
          payment_provider: string | null
          plan: Database["public"]["Enums"]["subscription_plan"] | null
          show_ads: boolean | null
          started_at: string | null
          trial_ends_at: string | null
          trial_started_at: string | null
          trial_used: boolean | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          active_features?: string[] | null
          ai_requests_reset_at?: string | null
          ai_requests_today?: number | null
          backed_up_at?: string | null
          billing_status?:
            | Database["public"]["Enums"]["billing_status_type"]
            | null
          cancelled_at?: string | null
          created_at?: string | null
          current_period_end?: string | null
          current_period_start?: string | null
          expires_at?: string | null
          external_customer_id?: string | null
          external_subscription_id?: string | null
          id?: string | null
          is_founder?: boolean | null
          payment_provider?: string | null
          plan?: Database["public"]["Enums"]["subscription_plan"] | null
          show_ads?: boolean | null
          started_at?: string | null
          trial_ends_at?: string | null
          trial_started_at?: string | null
          trial_used?: boolean | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          active_features?: string[] | null
          ai_requests_reset_at?: string | null
          ai_requests_today?: number | null
          backed_up_at?: string | null
          billing_status?:
            | Database["public"]["Enums"]["billing_status_type"]
            | null
          cancelled_at?: string | null
          created_at?: string | null
          current_period_end?: string | null
          current_period_start?: string | null
          expires_at?: string | null
          external_customer_id?: string | null
          external_subscription_id?: string | null
          id?: string | null
          is_founder?: boolean | null
          payment_provider?: string | null
          plan?: Database["public"]["Enums"]["subscription_plan"] | null
          show_ads?: boolean | null
          started_at?: string | null
          trial_ends_at?: string | null
          trial_started_at?: string | null
          trial_used?: boolean | null
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      training_days: {
        Row: {
          completed_at: string | null
          created_at: string
          day_name: string
          day_number: number
          duration_minutes: number | null
          id: string
          objective: string | null
          session_type: Database["public"]["Enums"]["session_type_enum"]
          week_id: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          day_name: string
          day_number: number
          duration_minutes?: number | null
          id?: string
          objective?: string | null
          session_type: Database["public"]["Enums"]["session_type_enum"]
          week_id: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          day_name?: string
          day_number?: number
          duration_minutes?: number | null
          id?: string
          objective?: string | null
          session_type?: Database["public"]["Enums"]["session_type_enum"]
          week_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "training_days_week_id_fkey"
            columns: ["week_id"]
            isOneToOne: false
            referencedRelation: "weeks"
            referencedColumns: ["id"]
          },
        ]
      }
      training_programs: {
        Row: {
          active_day: number
          active_week: number
          archived_at: string | null
          available_days: number
          created_at: string
          experience_level: Database["public"]["Enums"]["experience_level_enum"]
          generated_from_engine: string
          goal: Database["public"]["Enums"]["goal_enum"]
          id: string
          reference_velocity: number | null
          total_weeks: number
          updated_at: string
          user_id: string
        }
        Insert: {
          active_day?: number
          active_week?: number
          archived_at?: string | null
          available_days: number
          created_at?: string
          experience_level: Database["public"]["Enums"]["experience_level_enum"]
          generated_from_engine?: string
          goal: Database["public"]["Enums"]["goal_enum"]
          id?: string
          reference_velocity?: number | null
          total_weeks?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          active_day?: number
          active_week?: number
          archived_at?: string | null
          available_days?: number
          created_at?: string
          experience_level?: Database["public"]["Enums"]["experience_level_enum"]
          generated_from_engine?: string
          goal?: Database["public"]["Enums"]["goal_enum"]
          id?: string
          reference_velocity?: number | null
          total_weeks?: number
          updated_at?: string
          user_id?: string
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
      user_ai_coaches: {
        Row: {
          assigned_at: string
          coach_id: string
          id: string
          is_primary: boolean
          user_id: string
        }
        Insert: {
          assigned_at?: string
          coach_id: string
          id?: string
          is_primary?: boolean
          user_id: string
        }
        Update: {
          assigned_at?: string
          coach_id?: string
          id?: string
          is_primary?: boolean
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_ai_coaches_coach_id_fkey"
            columns: ["coach_id"]
            isOneToOne: false
            referencedRelation: "ai_coaches"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      weeks: {
        Row: {
          created_at: string
          id: string
          mesocycle_id: string
          program_id: string
          week_number: number
          week_type: Database["public"]["Enums"]["week_type_enum"]
        }
        Insert: {
          created_at?: string
          id?: string
          mesocycle_id: string
          program_id: string
          week_number: number
          week_type: Database["public"]["Enums"]["week_type_enum"]
        }
        Update: {
          created_at?: string
          id?: string
          mesocycle_id?: string
          program_id?: string
          week_number?: number
          week_type?: Database["public"]["Enums"]["week_type_enum"]
        }
        Relationships: [
          {
            foreignKeyName: "weeks_mesocycle_id_fkey"
            columns: ["mesocycle_id"]
            isOneToOne: false
            referencedRelation: "mesocycles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "weeks_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "training_programs"
            referencedColumns: ["id"]
          },
        ]
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
      workout_live_state: {
        Row: {
          created_at: string
          current_exercise_index: number
          current_set_index: number
          device_id: string | null
          id: string
          last_heartbeat_at: string
          phase: Database["public"]["Enums"]["workout_phase"]
          phase_started_at: string
          rest_duration_planned: number | null
          session_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          current_exercise_index?: number
          current_set_index?: number
          device_id?: string | null
          id?: string
          last_heartbeat_at?: string
          phase?: Database["public"]["Enums"]["workout_phase"]
          phase_started_at?: string
          rest_duration_planned?: number | null
          session_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          current_exercise_index?: number
          current_set_index?: number
          device_id?: string | null
          id?: string
          last_heartbeat_at?: string
          phase?: Database["public"]["Enums"]["workout_phase"]
          phase_started_at?: string
          rest_duration_planned?: number | null
          session_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "workout_live_state_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "workout_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      workout_sessions: {
        Row: {
          avg_heart_rate: number | null
          calories_burned: number | null
          completed_at: string | null
          completed_summary: Json
          created_at: string
          current_block: number | null
          current_exercise_index: number
          current_interval: number | null
          current_set: number
          current_step: number
          day_key: string
          duration_min: number | null
          duration_seconds: number | null
          elapsed_seconds: number
          estimated_calories: number | null
          finished_at: string | null
          id: string
          max_heart_rate: number | null
          notes: string | null
          readiness_score_at_start: number | null
          scheduled_date: string | null
          session_data: Json
          started_at: string | null
          status: string
          total_elapsed_seconds: number
          updated_at: string
          user_id: string
          week_number: number
        }
        Insert: {
          avg_heart_rate?: number | null
          calories_burned?: number | null
          completed_at?: string | null
          completed_summary?: Json
          created_at?: string
          current_block?: number | null
          current_exercise_index?: number
          current_interval?: number | null
          current_set?: number
          current_step?: number
          day_key: string
          duration_min?: number | null
          duration_seconds?: number | null
          elapsed_seconds?: number
          estimated_calories?: number | null
          finished_at?: string | null
          id?: string
          max_heart_rate?: number | null
          notes?: string | null
          readiness_score_at_start?: number | null
          scheduled_date?: string | null
          session_data?: Json
          started_at?: string | null
          status?: string
          total_elapsed_seconds?: number
          updated_at?: string
          user_id: string
          week_number: number
        }
        Update: {
          avg_heart_rate?: number | null
          calories_burned?: number | null
          completed_at?: string | null
          completed_summary?: Json
          created_at?: string
          current_block?: number | null
          current_exercise_index?: number
          current_interval?: number | null
          current_set?: number
          current_step?: number
          day_key?: string
          duration_min?: number | null
          duration_seconds?: number | null
          elapsed_seconds?: number
          estimated_calories?: number | null
          finished_at?: string | null
          id?: string
          max_heart_rate?: number | null
          notes?: string | null
          readiness_score_at_start?: number | null
          scheduled_date?: string | null
          session_data?: Json
          started_at?: string | null
          status?: string
          total_elapsed_seconds?: number
          updated_at?: string
          user_id?: string
          week_number?: number
        }
        Relationships: []
      }
      workout_set_logs: {
        Row: {
          actual_duration_seconds: number | null
          actual_load_kg: number | null
          actual_reps: number | null
          actual_rpe: number | null
          completed_at: string | null
          created_at: string
          exercise_id: string | null
          exercise_index: number
          exercise_name: string
          hr_avg_during_set: number | null
          id: string
          load_delta_suggested_kg: number | null
          load_signal: Database["public"]["Enums"]["load_signal"] | null
          notes: string | null
          planned_duration_seconds: number | null
          planned_load_kg: number | null
          planned_reps: string | null
          planned_rpe: number | null
          rest_seconds: number | null
          set_number: number
          set_status: string
          started_at: string | null
          time_under_tension_est: number | null
          updated_at: string
          user_id: string
          velocity_category:
            | Database["public"]["Enums"]["velocity_category"]
            | null
          workout_session_id: string
        }
        Insert: {
          actual_duration_seconds?: number | null
          actual_load_kg?: number | null
          actual_reps?: number | null
          actual_rpe?: number | null
          completed_at?: string | null
          created_at?: string
          exercise_id?: string | null
          exercise_index?: number
          exercise_name: string
          hr_avg_during_set?: number | null
          id?: string
          load_delta_suggested_kg?: number | null
          load_signal?: Database["public"]["Enums"]["load_signal"] | null
          notes?: string | null
          planned_duration_seconds?: number | null
          planned_load_kg?: number | null
          planned_reps?: string | null
          planned_rpe?: number | null
          rest_seconds?: number | null
          set_number: number
          set_status?: string
          started_at?: string | null
          time_under_tension_est?: number | null
          updated_at?: string
          user_id: string
          velocity_category?:
            | Database["public"]["Enums"]["velocity_category"]
            | null
          workout_session_id: string
        }
        Update: {
          actual_duration_seconds?: number | null
          actual_load_kg?: number | null
          actual_reps?: number | null
          actual_rpe?: number | null
          completed_at?: string | null
          created_at?: string
          exercise_id?: string | null
          exercise_index?: number
          exercise_name?: string
          hr_avg_during_set?: number | null
          id?: string
          load_delta_suggested_kg?: number | null
          load_signal?: Database["public"]["Enums"]["load_signal"] | null
          notes?: string | null
          planned_duration_seconds?: number | null
          planned_load_kg?: number | null
          planned_reps?: string | null
          planned_rpe?: number | null
          rest_seconds?: number | null
          set_number?: number
          set_status?: string
          started_at?: string | null
          time_under_tension_est?: number | null
          updated_at?: string
          user_id?: string
          velocity_category?:
            | Database["public"]["Enums"]["velocity_category"]
            | null
          workout_session_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "workout_set_logs_workout_session_id_fkey"
            columns: ["workout_session_id"]
            isOneToOne: false
            referencedRelation: "workout_sessions"
            referencedColumns: ["id"]
          },
        ]
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
      activate_program: { Args: { p_program_id: string }; Returns: undefined }
      are_friends: { Args: { a: string; b: string }; Returns: boolean }
      custom_access_token_hook: { Args: { event: Json }; Returns: Json }
      gen_friend_code: { Args: never; Returns: string }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      increment_ai_request: {
        Args: { p_limit: number; p_user_id: string }
        Returns: {
          allowed: boolean
          remaining: number
          used: number
        }[]
      }
      is_pro: { Args: { uid: string }; Returns: boolean }
      match_knowledge_chunks: {
        Args: {
          filter_language?: string
          filter_tags?: string[]
          match_count?: number
          match_threshold?: number
          query_embedding: string
        }
        Returns: {
          author: string
          chunk_index: number
          content: string
          document_id: string
          id: string
          similarity: number
          source_type: string
          tags: string[]
          title: string
        }[]
      }
    }
    Enums: {
      app_role: "admin" | "moderator" | "user"
      billing_status_type:
        | "active"
        | "trialing"
        | "past_due"
        | "canceled"
        | "unpaid"
        | "incomplete"
      exercise_category_enum:
        | "biceps"
        | "triceps"
        | "chest"
        | "lats"
        | "back"
        | "trap"
        | "shoulder"
        | "rotator_cuff"
        | "posterior_chain"
        | "anterior_chain"
        | "calf"
        | "core"
        | "plyometric"
      exercise_media_type:
        | "youtube_embed"
        | "vimeo_embed"
        | "external_video"
        | "uploaded_video"
        | "gif"
        | "image"
      experience_level_enum: "beginner" | "intermediate" | "advanced"
      goal_enum:
        | "fat_loss"
        | "hypertrophy"
        | "endurance"
        | "hybrid"
        | "general_health"
        | "conditioning"
        | "run_5k"
      load_signal: "increase" | "maintain" | "decrease" | "na"
      recommended_intensity: "rest" | "easy" | "moderate" | "hard" | "peak"
      running_protocol_enum:
        | "z2"
        | "vo2"
        | "tempo"
        | "intervals"
        | "recovery"
        | "threshold"
        | "vo2_intervals"
        | "tempo_run"
        | "zone_2"
        | "pace_work"
        | "recovery_run"
      session_type_enum: "full_body" | "run_upper" | "run" | "rest"
      sex_enum: "male" | "female" | "other" | "prefer_not_to_say"
      subscription_plan: "free" | "premium" | "premium_ai" | "plus" | "pro"
      velocity_category: "fast" | "normal" | "slow" | "failed"
      wearable_platform:
        | "apple_healthkit"
        | "google_health_connect"
        | "garmin"
        | "polar"
        | "fitbit"
        | "whoop"
        | "withings"
        | "samsung_health"
        | "healthkit"
        | "health_connect"
      week_type_enum: "A" | "B"
      workout_phase: "idle" | "exercising" | "resting" | "paused" | "finished"
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
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      app_role: ["admin", "moderator", "user"],
      billing_status_type: [
        "active",
        "trialing",
        "past_due",
        "canceled",
        "unpaid",
        "incomplete",
      ],
      exercise_category_enum: [
        "biceps",
        "triceps",
        "chest",
        "lats",
        "back",
        "trap",
        "shoulder",
        "rotator_cuff",
        "posterior_chain",
        "anterior_chain",
        "calf",
        "core",
        "plyometric",
      ],
      exercise_media_type: [
        "youtube_embed",
        "vimeo_embed",
        "external_video",
        "uploaded_video",
        "gif",
        "image",
      ],
      experience_level_enum: ["beginner", "intermediate", "advanced"],
      goal_enum: [
        "fat_loss",
        "hypertrophy",
        "endurance",
        "hybrid",
        "general_health",
        "conditioning",
        "run_5k",
      ],
      load_signal: ["increase", "maintain", "decrease", "na"],
      recommended_intensity: ["rest", "easy", "moderate", "hard", "peak"],
      running_protocol_enum: [
        "z2",
        "vo2",
        "tempo",
        "intervals",
        "recovery",
        "threshold",
        "vo2_intervals",
        "tempo_run",
        "zone_2",
        "pace_work",
        "recovery_run",
      ],
      session_type_enum: ["full_body", "run_upper", "run", "rest"],
      sex_enum: ["male", "female", "other", "prefer_not_to_say"],
      subscription_plan: ["free", "premium", "premium_ai", "plus", "pro"],
      velocity_category: ["fast", "normal", "slow", "failed"],
      wearable_platform: [
        "apple_healthkit",
        "google_health_connect",
        "garmin",
        "polar",
        "fitbit",
        "whoop",
        "withings",
        "samsung_health",
        "healthkit",
        "health_connect",
      ],
      week_type_enum: ["A", "B"],
      workout_phase: ["idle", "exercising", "resting", "paused", "finished"],
    },
  },
} as const

