-- Raise the upload limit for creative, designs and brand files to 200 MB per file.
update storage.buckets set file_size_limit = 209715200 where id = 'media';
