import { useEffect, useState } from 'react'
import { useMatch, useNavigate } from 'react-router-dom'
import ConfirmDialog from '@/components/common/ConfirmDialog'
import ExportMenu from '@/components/common/ExportMenu'
import PageHeader from '@/components/common/PageHeader'
import BulkActionBar from '@/components/transactions/BulkActionBar'
import Pagination from '@/components/transactions/Pagination'
import TransactionFilters from '@/components/transactions/TransactionFilters'
import TransactionForm from '@/components/transactions/TransactionForm'
import TransactionTable from '@/components/transactions/TransactionTable'
import Alert from '@/components/ui/Alert'
import Button, { ButtonLink } from '@/components/ui/Button'
import Card from '@/components/ui/Card'
import EmptyState from '@/components/ui/EmptyState'
import Icon from '@/components/ui/Icon'
import Modal from '@/components/ui/Modal'
import Spinner from '@/components/ui/Spinner'
import { ROUTES, transactionEditPath } from '@/constants/routes'
import { useAsync } from '@/hooks/useAsync'
import { useAuth } from '@/hooks/useAuth'
import { useCategories } from '@/hooks/useCategories'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'
import { useToast } from '@/hooks/useToast'
import { useTransactionQuery } from '@/hooks/useTransactionQuery'
import { transactionService } from '@/services/transactionService'
import { getErrorMessage } from '@/utils/errors'

export default function TransactionsPage() {
  useDocumentTitle('Transactions')
  const { user } = useAuth()
  const { notify } = useToast()
  const navigate = useNavigate()
  const { categories } = useCategories()
  const query = useTransactionQuery()

  const { data, loading, error, reload } = useAsync(
    () => transactionService.list(query.apiQuery),
    [JSON.stringify(query.apiQuery)],
  )

  // ----- selection (cleared whenever the visible rows change) -----
  const [selected, setSelected] = useState(() => new Set())
  useEffect(() => setSelected(new Set()), [data])
  const toggle = (id) =>
    setSelected((s) => {
      const next = new Set(s)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  const toggleAll = () =>
    setSelected((s) =>
      data.items.every((t) => s.has(t.id)) ? new Set() : new Set(data.items.map((t) => t.id)),
    )

  // ----- add / edit dialog, driven by the URL -----
  const isNew = Boolean(useMatch(ROUTES.TRANSACTION_NEW))
  const editId = useMatch(ROUTES.TRANSACTION_EDIT)?.params.id
  const withQuery = (path) => (query.search ? `${path}?${query.search}` : path)
  const closeForm = () => navigate(withQuery(ROUTES.TRANSACTIONS))

  const save = async (payload, { addAnother }) => {
    if (editId) {
      await transactionService.update(editId, payload)
      notify('Changes saved')
    } else {
      await transactionService.create(payload)
      notify(`${payload.type === 'income' ? 'Income' : 'Expense'} “${payload.title}” added`)
    }
    reload()
    if (!addAnother) closeForm()
  }

  // ----- delete (one row or the current selection) -----
  const [pendingDelete, setPendingDelete] = useState(null) // { ids, label }
  const [deleting, setDeleting] = useState(false)

  const confirmDelete = async () => {
    setDeleting(true)
    try {
      const { ids } = pendingDelete
      const count =
        ids.length === 1
          ? (await transactionService.remove(ids[0]), 1)
          : await transactionService.bulkDelete(ids)
      notify(count === 1 ? 'Transaction deleted' : `${count} transactions deleted`)
      setPendingDelete(null)
      // If that emptied the page, step back one.
      if (ids.length >= data.items.length && query.page > 1) query.update({ page: query.page - 1 })
      else reload()
    } catch (err) {
      notify(getErrorMessage(err), { type: 'error' })
    } finally {
      setDeleting(false)
    }
  }

  // A page number past the end (e.g. from an old link) jumps to the last page.
  useEffect(() => {
    if (data && data.items.length === 0 && data.total > 0 && query.page > 1) {
      query.update({ page: Math.ceil(data.total / query.pageSize) }, { replace: true })
    }
  }, [data, query])

  const newButton = (
    <ButtonLink to={withQuery(ROUTES.TRANSACTION_NEW)}>
      <Icon name="plus" className="h-4 w-4" />
      Add transaction
    </ButtonLink>
  )

  return (
    <>
      <PageHeader
        title="Transactions"
        description="Search, filter and manage every income and expense."
        actions={
          <>
            <ExportMenu
              filters={query.apiQuery}
              disabled={!data?.total}
              description={
                query.activeFilterCount
                  ? `Exports the ${data?.total ?? ''} transactions matching your filters, in the current sort order.`
                  : `Exports all ${data?.total ?? ''} transactions.`
              }
            />
            {newButton}
          </>
        }
      />

      <Card>
        <TransactionFilters query={query} categories={categories} />

        <div className="mt-5">
          <BulkActionBar
            count={selected.size}
            onClear={() => setSelected(new Set())}
            onDelete={() =>
              setPendingDelete({
                ids: [...selected],
                label: `${selected.size} selected transactions`,
              })
            }
          />

          {error && (
            <Alert title="Couldn’t load transactions">
              {error}{' '}
              <button type="button" className="font-medium underline" onClick={reload}>
                Try again
              </button>
            </Alert>
          )}

          {loading && !data && (
            <div className="flex justify-center py-16 text-brand-600">
              <Spinner className="h-6 w-6" />
            </div>
          )}

          {data && data.items.length === 0 && data.total === 0 && (
            <EmptyState
              icon={query.activeFilterCount ? 'search' : 'list'}
              title={query.activeFilterCount ? 'No matching transactions' : 'No transactions yet'}
              description={
                query.activeFilterCount
                  ? 'Try a different search or clear the filters.'
                  : 'Add your first income or expense to get started.'
              }
              action={
                query.activeFilterCount ? (
                  <Button variant="secondary" onClick={query.clearFilters}>
                    Clear filters
                  </Button>
                ) : (
                  newButton
                )
              }
            />
          )}

          {data && data.items.length > 0 && (
            <div
              className={loading ? 'opacity-60 transition-opacity' : undefined}
              aria-busy={loading}
            >
              <TransactionTable
                items={data.items}
                selected={selected}
                onToggle={toggle}
                onToggleAll={toggleAll}
                sort={query.sort}
                onSort={(sort) => query.update({ sort })}
                onEdit={(t) => navigate(withQuery(transactionEditPath(t.id)))}
                onDelete={(t) => setPendingDelete({ ids: [t.id], label: `“${t.title}”` })}
              />
              <div className="mt-4">
                <Pagination
                  page={query.page}
                  pageSize={query.pageSize}
                  total={data.total}
                  onPageChange={(page) => query.update({ page })}
                  onPageSizeChange={(page_size) => query.update({ page_size })}
                />
              </div>
            </div>
          )}
        </div>
      </Card>

      {isNew && (
        <TransactionForm
          key="new"
          categories={categories}
          currency={user.currency}
          onClose={closeForm}
          onSubmit={save}
        />
      )}
      {editId && (
        <EditTransaction
          id={editId}
          listed={data?.items.find((t) => t.id === editId)}
          categories={categories}
          currency={user.currency}
          onClose={closeForm}
          onSubmit={save}
        />
      )}

      <ConfirmDialog
        open={Boolean(pendingDelete)}
        title={
          pendingDelete?.ids.length > 1
            ? `Delete ${pendingDelete.ids.length} transactions?`
            : 'Delete transaction?'
        }
        message={
          pendingDelete &&
          `${pendingDelete.label} will be removed from your history, totals and budgets.`
        }
        confirmLabel="Delete"
        loading={deleting}
        onConfirm={confirmDelete}
        onCancel={() => setPendingDelete(null)}
      />
    </>
  )
}

/**
 * Edit dialog for /transactions/:id/edit. Uses the row already on screen when there is one;
 * otherwise (opened from a link or after a reload) fetches the transaction first.
 */
function EditTransaction({ id, listed, onClose, ...formProps }) {
  const { data, error } = useAsync(
    () => (listed ? Promise.resolve(listed) : transactionService.get(id)),
    [id],
  )
  const transaction = listed ?? data

  if (transaction) {
    return <TransactionForm key={id} transaction={transaction} onClose={onClose} {...formProps} />
  }
  return (
    <Modal open title="Edit transaction" onClose={onClose}>
      {error ? (
        <div className="space-y-4">
          <Alert title="Can’t open this transaction">{error}</Alert>
          <div className="flex justify-end">
            <Button variant="secondary" onClick={onClose}>
              Back to list
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex justify-center py-8 text-brand-600">
          <Spinner className="h-6 w-6" />
        </div>
      )}
    </Modal>
  )
}
