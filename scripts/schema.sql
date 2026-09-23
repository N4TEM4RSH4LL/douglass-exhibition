CREATE TABLE IF NOT EXISTS exhibition_fields (
 exhibition_id text NOT NULL,
 field_id text NOT NULL,
 value text NOT NULL,
 revision integer NOT NULL CHECK (revision > 0),
 updated_at timestamptz NOT NULL DEFAULT now(),
 writer text NOT NULL,
 PRIMARY KEY (exhibition_id, field_id)
);
-- statement boundary
CREATE TABLE IF NOT EXISTS exhibition_history (
 exhibition_id text NOT NULL,
 field_id text NOT NULL,
 value text NOT NULL,
 revision integer NOT NULL,
 changed_at timestamptz NOT NULL DEFAULT now(),
 writer text NOT NULL,
 mutation_id uuid NOT NULL,
 PRIMARY KEY (exhibition_id, field_id, revision),
 UNIQUE (exhibition_id, mutation_id)
);
-- statement boundary
CREATE OR REPLACE FUNCTION exhibition_save(
 p_exhibition text, p_field text, p_value text, p_expected integer, p_writer text, p_mutation uuid
) RETURNS jsonb LANGUAGE plpgsql AS $$
DECLARE current_row exhibition_fields%ROWTYPE; prior exhibition_history%ROWTYPE; result jsonb;
BEGIN
 PERFORM pg_advisory_xact_lock(hashtextextended(p_exhibition || ':' || p_field, 0));
 SELECT * INTO prior FROM exhibition_history WHERE exhibition_id=p_exhibition AND mutation_id=p_mutation;
 IF FOUND THEN
  IF prior.field_id<>p_field OR prior.value<>p_value THEN
   RETURN jsonb_build_object('invalidMutation',true);
  END IF;
  RETURN jsonb_build_object('ok',true,'field',jsonb_build_object('value',prior.value,'revision',prior.revision,'updatedAt',prior.changed_at,'writer',prior.writer,'mutationId',prior.mutation_id));
 END IF;
 SELECT * INTO current_row FROM exhibition_fields WHERE exhibition_id=p_exhibition AND field_id=p_field;
 IF COALESCE(current_row.revision,0)<>p_expected THEN
  RETURN jsonb_build_object('ok',false,'current',jsonb_build_object('value',COALESCE(current_row.value,''),'revision',COALESCE(current_row.revision,0),'updatedAt',current_row.updated_at,'writer',COALESCE(current_row.writer,''),'mutationId',(SELECT mutation_id FROM exhibition_history WHERE exhibition_id=p_exhibition AND field_id=p_field AND revision=current_row.revision)));
 END IF;
 INSERT INTO exhibition_fields(exhibition_id,field_id,value,revision,writer)
 VALUES(p_exhibition,p_field,p_value,p_expected+1,p_writer)
 ON CONFLICT(exhibition_id,field_id) DO UPDATE SET value=EXCLUDED.value,revision=EXCLUDED.revision,writer=EXCLUDED.writer,updated_at=now()
 RETURNING * INTO current_row;
 INSERT INTO exhibition_history(exhibition_id,field_id,value,revision,writer,mutation_id)
 VALUES(p_exhibition,p_field,p_value,current_row.revision,p_writer,p_mutation);
 RETURN jsonb_build_object('ok',true,'field',jsonb_build_object('value',current_row.value,'revision',current_row.revision,'updatedAt',current_row.updated_at,'writer',current_row.writer,'mutationId',p_mutation));
END; $$;

-- statement boundary
CREATE TABLE IF NOT EXISTS exhibition_media (
 exhibition_id text NOT NULL,
 id text NOT NULL,
 mime text NOT NULL,
 data bytea NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(exhibition_id,id)
);
