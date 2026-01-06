'use client'

import { useState } from 'react'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { CreateSkillDialog } from './create-skill-dialog'
import { EditSkillDialog } from './edit-skill-dialog'
import { updateSkill, deleteSkill } from '@/lib/actions/admin-skills'
import { useRouter } from 'next/navigation'
import { AlertDialogConfirm } from '@/components/ui/alert-dialog-confirm'

interface Skill {
  id: number
  name: string
  description: string | null
  color: string
  is_active: boolean
  created_at: string
}

interface SkillsTableProps {
  skills: Skill[]
}

export const SkillsTable = ({ skills }: SkillsTableProps) => {
  const router = useRouter()
  const [isDeleting, setIsDeleting] = useState<number | null>(null)
  const [deleteConfirmId, setDeleteConfirmId] = useState<number | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const handleToggleStatus = async (id: number, currentStatus: boolean) => {
    const result = await updateSkill(id, { is_active: !currentStatus })
    if (!result.error) {
      router.refresh()
    }
  }

  const handleDelete = async () => {
    if (deleteConfirmId === null) return

    setIsDeleting(deleteConfirmId)
    const result = await deleteSkill(deleteConfirmId)
    
    if (result.error) {
      setErrorMessage(result.error)
    } else {
      router.refresh()
    }
    setIsDeleting(null)
    setDeleteConfirmId(null)
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <CreateSkillDialog />
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Description</TableHead>
            <TableHead>Color</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {skills.length === 0 ? (
            <TableRow>
              <TableCell colSpan={5} className="text-center text-muted-foreground">
                No skills found
              </TableCell>
            </TableRow>
          ) : (
            skills.map((skill) => (
              <TableRow key={skill.id}>
                <TableCell className="font-medium">
                  <div className="flex items-center gap-2">
                    <div 
                      className="w-4 h-4 rounded-full" 
                      style={{ backgroundColor: skill.color }}
                    />
                    {skill.name}
                  </div>
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {skill.description || '-'}
                </TableCell>
                <TableCell>
                  <Badge 
                    variant="secondary"
                    style={{ 
                      backgroundColor: skill.color + '20',
                      borderColor: skill.color,
                      color: skill.color
                    }}
                  >
                    {skill.color}
                  </Badge>
                </TableCell>
                <TableCell>
                  <Badge variant={skill.is_active ? 'default' : 'secondary'}>
                    {skill.is_active ? 'Active' : 'Inactive'}
                  </Badge>
                </TableCell>
                <TableCell>
                  <div className="flex gap-2">
                    <EditSkillDialog skill={skill} />
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleToggleStatus(skill.id, skill.is_active)}
                    >
                      {skill.is_active ? 'Deactivate' : 'Activate'}
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => setDeleteConfirmId(skill.id)}
                      disabled={isDeleting === skill.id}
                    >
                      {isDeleting === skill.id ? 'Deleting...' : 'Delete'}
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>

      <AlertDialogConfirm
        open={deleteConfirmId !== null}
        onOpenChange={(open) => !open && setDeleteConfirmId(null)}
        onConfirm={handleDelete}
        title="Delete Skill"
        description="Are you sure you want to delete this skill? This action cannot be undone."
        confirmText="Delete"
        cancelText="Cancel"
        variant="destructive"
      />

      <AlertDialogConfirm
        open={errorMessage !== null}
        onOpenChange={(open) => !open && setErrorMessage(null)}
        onConfirm={() => setErrorMessage(null)}
        title="Error"
        description={errorMessage || 'An error occurred'}
        confirmText="OK"
        variant="destructive"
      />
    </div>
  )
}

