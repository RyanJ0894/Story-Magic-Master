-- =============================================================================
-- Script Corpus with pgvector for Comparable Scripts Feature
-- =============================================================================

-- Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- =============================================================================
-- Script Corpus Table
-- =============================================================================

CREATE TABLE IF NOT EXISTS script_corpus (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Basic metadata
    title TEXT NOT NULL,
    logline TEXT,
    genre TEXT[] DEFAULT '{}',
    tone TEXT,

    -- Production info
    writer TEXT,
    sale_date DATE,
    production_status TEXT, -- 'sold', 'produced', 'optioned', 'unproduced'
    studio TEXT,
    budget_tier TEXT, -- 'micro', 'indie', 'mid', 'tentpole'
    box_office_millions DECIMAL(10,2),

    -- Embeddings (OpenAI text-embedding-3-small = 1536 dims)
    logline_embedding VECTOR(1536),

    -- Source info
    is_public BOOLEAN DEFAULT false,
    source TEXT, -- 'user_upload', 'public_domain', 'licensed'
    uploaded_by UUID REFERENCES auth.users(id),

    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================================================
-- Indexes
-- =============================================================================

-- Vector similarity search index (HNSW is more efficient than IVFFlat for smaller datasets)
CREATE INDEX IF NOT EXISTS idx_script_corpus_logline_embedding
ON script_corpus
USING hnsw (logline_embedding vector_cosine_ops);

-- Standard indexes
CREATE INDEX IF NOT EXISTS idx_script_corpus_genre ON script_corpus USING GIN (genre);
CREATE INDEX IF NOT EXISTS idx_script_corpus_production_status ON script_corpus (production_status);
CREATE INDEX IF NOT EXISTS idx_script_corpus_is_public ON script_corpus (is_public);

-- =============================================================================
-- RLS Policies
-- =============================================================================

ALTER TABLE script_corpus ENABLE ROW LEVEL SECURITY;

-- Anyone can read public scripts
CREATE POLICY "Public scripts are viewable by all"
    ON script_corpus
    FOR SELECT
    USING (is_public = true);

-- Users can view their own uploads
CREATE POLICY "Users can view own uploads"
    ON script_corpus
    FOR SELECT
    USING (uploaded_by = auth.uid());

-- Only admins can insert/update/delete (for now)
-- Later we can add user upload capability

-- =============================================================================
-- Similarity Search Function
-- =============================================================================

CREATE OR REPLACE FUNCTION search_similar_scripts(
    query_embedding VECTOR(1536),
    match_threshold FLOAT DEFAULT 0.7,
    match_count INT DEFAULT 5,
    filter_production_status TEXT[] DEFAULT NULL,
    filter_genre TEXT[] DEFAULT NULL
)
RETURNS TABLE (
    id UUID,
    title TEXT,
    logline TEXT,
    genre TEXT[],
    tone TEXT,
    production_status TEXT,
    studio TEXT,
    budget_tier TEXT,
    box_office_millions DECIMAL,
    similarity FLOAT
)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    SELECT
        sc.id,
        sc.title,
        sc.logline,
        sc.genre,
        sc.tone,
        sc.production_status,
        sc.studio,
        sc.budget_tier,
        sc.box_office_millions,
        1 - (sc.logline_embedding <=> query_embedding) AS similarity
    FROM script_corpus sc
    WHERE sc.is_public = true
        AND sc.logline_embedding IS NOT NULL
        AND 1 - (sc.logline_embedding <=> query_embedding) > match_threshold
        AND (filter_production_status IS NULL OR sc.production_status = ANY(filter_production_status))
        AND (filter_genre IS NULL OR sc.genre && filter_genre)
    ORDER BY sc.logline_embedding <=> query_embedding
    LIMIT match_count;
END;
$$;

-- =============================================================================
-- Seed Some Public Domain / Example Scripts
-- =============================================================================

-- Note: These are placeholder entries with NULL embeddings.
-- Embeddings should be generated via the embedding service.
-- In production, you'd run a batch job to populate embeddings.

INSERT INTO script_corpus (
    title, logline, genre, tone, production_status, studio, budget_tier, box_office_millions, is_public, source
) VALUES
    ('The Godfather', 'The aging patriarch of an organized crime dynasty transfers control to his reluctant son.',
     ARRAY['Crime', 'Drama'], 'Dark, Epic', 'produced', 'Paramount', 'tentpole', 250, true, 'public_domain'),

    ('Casablanca', 'A cynical American expatriate struggles to decide whether to help his former lover and her fugitive husband escape.',
     ARRAY['Drama', 'Romance', 'War'], 'Romantic, Tense', 'produced', 'Warner Bros', 'mid', 10, true, 'public_domain'),

    ('Chinatown', 'A private detective investigating an adultery case stumbles onto a dark conspiracy in 1930s Los Angeles.',
     ARRAY['Mystery', 'Thriller', 'Neo-Noir'], 'Cynical, Atmospheric', 'produced', 'Paramount', 'mid', 30, true, 'public_domain'),

    ('Rocky', 'A small-time boxer gets a chance to fight the heavyweight champion, finding his own self-worth along the way.',
     ARRAY['Drama', 'Sports'], 'Inspirational, Gritty', 'produced', 'United Artists', 'indie', 225, true, 'public_domain'),

    ('Jaws', 'A police chief, marine scientist, and grizzled fisherman set out to stop a killer shark terrorizing a beach community.',
     ARRAY['Thriller', 'Horror', 'Adventure'], 'Suspenseful, Tense', 'produced', 'Universal', 'mid', 470, true, 'public_domain'),

    ('Star Wars', 'A farm boy joins a rebellion against a galactic empire after discovering his destiny as a Jedi knight.',
     ARRAY['Sci-Fi', 'Adventure', 'Fantasy'], 'Epic, Hopeful', 'produced', '20th Century Fox', 'tentpole', 775, true, 'public_domain'),

    ('Alien', 'The crew of a commercial spaceship encounters a deadly extraterrestrial creature that picks them off one by one.',
     ARRAY['Sci-Fi', 'Horror'], 'Terrifying, Claustrophobic', 'produced', '20th Century Fox', 'mid', 180, true, 'public_domain'),

    ('Die Hard', 'A New York cop battles terrorists who have taken over a Los Angeles skyscraper during a Christmas party.',
     ARRAY['Action', 'Thriller'], 'Intense, Witty', 'produced', '20th Century Fox', 'tentpole', 140, true, 'public_domain'),

    ('Pulp Fiction', 'Interconnected stories of criminals and lowlifes in Los Angeles unfold in non-linear fashion.',
     ARRAY['Crime', 'Drama'], 'Stylized, Dark Comedy', 'produced', 'Miramax', 'indie', 214, true, 'public_domain'),

    ('The Matrix', 'A computer hacker discovers reality is a simulation and joins a rebellion against machine overlords.',
     ARRAY['Sci-Fi', 'Action'], 'Mind-bending, Philosophical', 'produced', 'Warner Bros', 'tentpole', 467, true, 'public_domain'),

    ('Get Out', 'A young Black man uncovers a disturbing secret when he meets his white girlfriend''s family for the first time.',
     ARRAY['Horror', 'Thriller'], 'Satirical, Unsettling', 'produced', 'Universal', 'micro', 255, true, 'public_domain'),

    ('Parasite', 'A poor family schemes to become employed by a wealthy household, with increasingly dark consequences.',
     ARRAY['Thriller', 'Drama', 'Dark Comedy'], 'Satirical, Tense', 'produced', 'CJ Entertainment', 'indie', 263, true, 'public_domain')
ON CONFLICT DO NOTHING;

-- =============================================================================
-- Updated timestamp trigger
-- =============================================================================

CREATE OR REPLACE FUNCTION update_script_corpus_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_script_corpus_updated_at
    BEFORE UPDATE ON script_corpus
    FOR EACH ROW
    EXECUTE FUNCTION update_script_corpus_updated_at();
